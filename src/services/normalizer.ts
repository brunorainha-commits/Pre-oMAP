// src/services/normalizer.ts
import type { NormalizedInvoice } from '../repositories/types';
import { productRepository } from '../repositories';

type RawValue = string | number | boolean | null | undefined;
type RawInvoiceItem = Record<string, RawValue>;
type RawInvoiceData = Record<string, RawValue | RawInvoiceItem[]>;

export const SINGLE_UNITS = ['UN', 'UND', 'PC', 'PEÇA', 'PÇ', 'PECA'];
export const WEIGHT_VOLUME_UNITS = ['KG', 'G', 'LT', 'L', 'ML', 'M', 'M2', 'M3'];
export const PACKAGING_UNITS = ['CX', 'CXA', 'CAIXA', 'FD', 'FARDO', 'PCT', 'PACOTE', 'PACK', 'EMB', 'DISPLAY', 'DZ', 'DUZIA', 'KIT'];
export const PACKAGING_REVIEW_WARNING = 'Informe quantas unidades existem dentro desta embalagem';

function normalizeUnit(unit: string | null | undefined): string {
  return unit ? unit.toUpperCase().trim() : '';
}

// Clean CNPJ / CPF formatting helper
export function formatDocument(doc: string | null): string | null {
  if (!doc) return null;
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

// Round to 2 decimal places
export function roundAmount(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function getNormalizedDescription(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectPackagingUnit(unit: string | null): boolean {
  return PACKAGING_UNITS.includes(normalizeUnit(unit));
}

export function detectBaseUnit(unit: string | null): string {
  const u = normalizeUnit(unit);
  if (!u) return 'UN';
  if (SINGLE_UNITS.includes(u)) return 'UN';
  if (WEIGHT_VOLUME_UNITS.includes(u)) return u;
  if (detectPackagingUnit(u)) return 'UN';
  return u;
}

// Extract units per package from product description
export function extractUnitsFromDescription(desc: string): number {
  const lowerDesc = desc.toLowerCase();
  const matchC = lowerDesc.match(/c\/\s*(\d+)/);
  if (matchC) return parseInt(matchC[1], 10);
  const matchCom = lowerDesc.match(/(?:caixa|cx)\s+com\s+(\d+)/);
  if (matchCom) return parseInt(matchCom[1], 10);
  const matchCx = lowerDesc.match(/cx\s*(\d+)/);
  if (matchCx) return parseInt(matchCx[1], 10);
  const matchUn = lowerDesc.match(/(?:\(|^|\s)(\d+)\s*(?:un|unid|unidades)(?:\)|$|\s)/);
  if (matchUn) return parseInt(matchUn[1], 10);
  return 1;
}

export function resolvePackageConversion(item: RawInvoiceItem): {
  units_per_package: number;
  packaging_requires_review: boolean;
  packaging_warning: string | null;
  matched_product_id: string | null;
  matched_product_name: string | null;
  matched_internal_unit: string | null;
  conversion_source: 'product' | 'description' | 'manual' | null;
} {
  const commercialUnit = normalizeUnit(String(item.commercial_unit || ''));
  const isPackaging = detectPackagingUnit(commercialUnit);
  const normDesc = getNormalizedDescription(String(item.description || item.normalized_description || ''));
  const existingProduct = productRepository.findBestMatchForItem({
    product_code: item.product_code ? String(item.product_code) : null,
    barcode: item.barcode ? String(item.barcode) : null,
    description: String(item.description || ''),
    normalized_description: normDesc
  });
  const baseMatch = {
    matched_product_id: existingProduct?.id || null,
    matched_product_name: existingProduct?.name || null,
    matched_internal_unit: existingProduct?.default_internal_unit || null
  };

  if (SINGLE_UNITS.includes(commercialUnit) || WEIGHT_VOLUME_UNITS.includes(commercialUnit)) {
    return {
      units_per_package: 1,
      packaging_requires_review: false,
      packaging_warning: null,
      ...baseMatch,
      conversion_source: existingProduct ? 'product' : null
    };
  }

  const productUnits = existingProduct?.units_per_package || 0;
  if (isPackaging && productUnits > 1) {
    return {
      units_per_package: productUnits,
      packaging_requires_review: false,
      packaging_warning: null,
      ...baseMatch,
      conversion_source: 'product'
    };
  }

  const descriptionUnits = isPackaging ? extractUnitsFromDescription(String(item.description || '')) : 1;
  if (isPackaging && descriptionUnits > 1) {
    return {
      units_per_package: descriptionUnits,
      packaging_requires_review: false,
      packaging_warning: null,
      ...baseMatch,
      conversion_source: 'description'
    };
  }

  if (isPackaging) {
    return {
      units_per_package: 1,
      packaging_requires_review: true,
      packaging_warning: PACKAGING_REVIEW_WARNING,
      ...baseMatch,
      conversion_source: null
    };
  }

  return {
    units_per_package: 1,
    packaging_requires_review: false,
    packaging_warning: null,
    ...baseMatch,
    conversion_source: existingProduct ? 'product' : null
  };
}

export function resolveUnitsPerPackage(item: RawInvoiceItem): number {
  return resolvePackageConversion(item).units_per_package;
}

export function calculateInternalQuantity(commercialQuantity: number, unitsPerPackage: number): number {
  return roundAmount(commercialQuantity * unitsPerPackage);
}

export function calculateInternalUnitPrice(commercialUnitPrice: number, unitsPerPackage: number): number {
  if (unitsPerPackage === 0) return commercialUnitPrice;
  return roundAmount(commercialUnitPrice / unitsPerPackage);
}

export function applyProductMemoryToInvoice(invoice: NormalizedInvoice): NormalizedInvoice {
  return {
    ...invoice,
    items: invoice.items.map(item => {
      const commercialUnit = item.commercial_unit ? String(item.commercial_unit).trim().toUpperCase() : 'UN';
      const packageConversion = resolvePackageConversion({
        ...item,
        commercial_unit: commercialUnit
      });
      const unitsPerPackage = packageConversion.units_per_package > 0 ? packageConversion.units_per_package : item.units_per_package || 1;
      const internalUnit = packageConversion.matched_internal_unit || item.internal_unit || detectBaseUnit(commercialUnit);

      return {
        ...item,
        product_id: packageConversion.matched_product_id || item.product_id,
        commercial_unit: commercialUnit,
        units_per_package: unitsPerPackage,
        internal_unit: internalUnit,
        internal_quantity: calculateInternalQuantity(item.commercial_quantity, unitsPerPackage),
        internal_unit_price: calculateInternalUnitPrice(item.commercial_unit_price, unitsPerPackage),
        packaging_requires_review: detectPackagingUnit(commercialUnit) && unitsPerPackage <= 1,
        packaging_warning: detectPackagingUnit(commercialUnit) && unitsPerPackage <= 1 ? PACKAGING_REVIEW_WARNING : null,
        conversion_source: packageConversion.conversion_source || item.conversion_source || null,
        matched_product_name: packageConversion.matched_product_name || item.matched_product_name || null,
        save_conversion_to_product: detectPackagingUnit(commercialUnit) ? item.save_conversion_to_product ?? true : item.save_conversion_to_product ?? false
      };
    }),
    updated_at: new Date().toISOString()
  };
}

// Primary normalization function
export function normalizeInvoiceData(rawInput: unknown, fileType: 'xml', fileName: string): NormalizedInvoice {
  const raw = rawInput as RawInvoiceData;
  const invoiceId = raw.id ? String(raw.id) : `ord-${Math.random().toString(36).substring(2, 9)}`;
  const dateStr = raw.issue_date ? String(raw.issue_date) : new Date().toISOString().split('T')[0];

  const normalizedItems = Array.isArray(raw.items) ? raw.items.map((item: RawInvoiceItem) => {
    const commUnit = item.commercial_unit ? String(item.commercial_unit).trim().toUpperCase() : 'UN';
    const commQty = Math.max(0, parseFloat(String(item.commercial_quantity || 0)) || 0);
    const commPrice = roundAmount(parseFloat(String(item.commercial_unit_price || 0)) || 0);
    const commTotal = roundAmount(parseFloat(String(item.commercial_total_price || 0)) || (commQty * commPrice) || 0);

    const packageConversion = resolvePackageConversion({ ...item, commercial_unit: commUnit });
    const upp = packageConversion.units_per_package;
    const intUnit = packageConversion.matched_internal_unit || detectBaseUnit(commUnit);
    const intQty = calculateInternalQuantity(commQty, upp);
    const intPrice = calculateInternalUnitPrice(commPrice, upp);

    return {
      product_id: packageConversion.matched_product_id,
      product_code: item.product_code ? String(item.product_code).trim() : null,
      barcode: item.barcode && item.barcode !== 'SEM GTIN' ? String(item.barcode).trim() : null,
      description: String(item.description).trim(),
      normalized_description: getNormalizedDescription(String(item.description || '')),
      ncm: item.ncm ? String(item.ncm).trim() : null,
      cfop: item.cfop ? String(item.cfop).trim() : null,

      commercial_unit: commUnit,
      commercial_quantity: commQty,
      commercial_unit_price: commPrice,
      commercial_total_price: commTotal,

      units_per_package: upp,
      internal_unit: intUnit,
      internal_quantity: intQty,
      internal_unit_price: intPrice,
      packaging_requires_review: packageConversion.packaging_requires_review,
      packaging_warning: packageConversion.packaging_warning,
      conversion_source: packageConversion.conversion_source,
      matched_product_name: packageConversion.matched_product_name,
      save_conversion_to_product: detectPackagingUnit(commUnit),

      discount: item.discount ? roundAmount(parseFloat(String(item.discount))) : null,
      uTrib: item.uTrib ? String(item.uTrib) : null,
      qTrib: parseFloat(String(item.qTrib || 0)) || 0,
      vUnTrib: parseFloat(String(item.vUnTrib || 0)) || 0
    };
  }) : [];

  return {
    id: invoiceId,
    source_file_name: fileName,
    source_file_type: fileType,
    invoice_key: raw.invoice_key ? String(raw.invoice_key).replace(/\s+/g, '') : null,
    invoice_number: raw.invoice_number ? String(raw.invoice_number).trim() : null,
    invoice_series: raw.invoice_series ? String(raw.invoice_series).trim() : null,
    order_number: raw.order_number ? String(raw.order_number).trim() : null,
    issue_date: dateStr,
    customer_name: raw.customer_name ? String(raw.customer_name).trim() : 'Revisar Cliente',
    customer_id: null,
    customer_document: formatDocument(raw.customer_document ? String(raw.customer_document) : null),
    customer_city: raw.customer_city ? String(raw.customer_city).trim() : null,
    customer_state: raw.customer_state ? String(raw.customer_state).trim() : null,
    issuer_name: raw.company_name ? String(raw.company_name).trim() : null,
    issuer_document: formatDocument(raw.company_document ? String(raw.company_document) : null),
    total_amount: roundAmount(parseFloat(String(raw.total_amount || 0)) || 0),
    products_amount: raw.products_amount ? roundAmount(parseFloat(String(raw.products_amount)) || 0) : null,
    discount_amount: raw.discount_amount ? roundAmount(parseFloat(String(raw.discount_amount)) || 0) : null,
    shipping_amount: raw.shipping_amount ? roundAmount(parseFloat(String(raw.shipping_amount)) || 0) : null,
    status: raw.status ? String(raw.status) as NormalizedInvoice['status'] : 'review',
    items: normalizedItems,
    raw_xml: raw.raw_xml ? String(raw.raw_xml) : null,
    created_at: raw.created_at ? String(raw.created_at) : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
