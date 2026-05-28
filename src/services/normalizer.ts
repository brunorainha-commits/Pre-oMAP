// src/services/normalizer.ts
import type { NormalizedInvoice } from '../repositories/types';
import { productRepository } from '../repositories';

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
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ' ') // replace symbols with spaces
    .replace(/\s+/g, ' ') // remove extra spaces
    .trim();
}

export function detectPackagingUnit(unit: string | null): boolean {
  if (!unit) return false;
  const u = unit.toUpperCase().trim();
  const pkgUnits = ['CX', 'CXA', 'CAIXA', 'FD', 'FARDO', 'PCT', 'PACOTE', 'PACK', 'EMB', 'DISPLAY', 'DZ', 'DUZIA', 'KIT'];
  return pkgUnits.includes(u);
}

export function detectBaseUnit(unit: string | null): string {
  if (!unit) return 'UN';
  const u = unit.toUpperCase().trim();
  const singleUnits = ['UN', 'UND', 'PC', 'PEÇA', 'PÇ'];
  const weightVolumeUnits = ['KG', 'G', 'LT', 'L', 'ML', 'M', 'M2', 'M3'];
  if (singleUnits.includes(u)) return 'UN';
  if (weightVolumeUnits.includes(u)) return u;
  if (detectPackagingUnit(u)) return 'UN'; // Internally, a box contains units
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

export function resolveUnitsPerPackage(item: any): number {
  // Try to find if product already has a config in the DB
  const normDesc = getNormalizedDescription(item.description);
  let existingProduct = productRepository.findByBarcode(item.barcode || '');
  if (!existingProduct && item.product_code) existingProduct = productRepository.findByCode(item.product_code);
  if (!existingProduct) existingProduct = productRepository.findByNormalizedName(normDesc);

  if (existingProduct && existingProduct.units_per_package) {
    return existingProduct.units_per_package;
  }

  // If packaging is detected, try to parse from description
  const isPkg = detectPackagingUnit(item.commercial_unit);
  if (isPkg) {
    const fromDesc = extractUnitsFromDescription(item.description);
    return fromDesc > 1 ? fromDesc : 1; // Default to 1 if we can't extract, user will fill it in Review
  }

  // If it's a single unit or weight, default to 1
  return 1;
}

export function calculateInternalQuantity(commercialQuantity: number, unitsPerPackage: number): number {
  return roundAmount(commercialQuantity * unitsPerPackage);
}

export function calculateInternalUnitPrice(commercialUnitPrice: number, unitsPerPackage: number): number {
  if (unitsPerPackage === 0) return commercialUnitPrice;
  return roundAmount(commercialUnitPrice / unitsPerPackage);
}

// Primary normalization function
export function normalizeInvoiceData(raw: any, fileType: 'xml', fileName: string): NormalizedInvoice {
  const invoiceId = raw.id || `ord-${Math.random().toString(36).substring(2, 9)}`;
  const dateStr = raw.issue_date || new Date().toISOString().split('T')[0];

  const normalizedItems = Array.isArray(raw.items) ? raw.items.map((item: any) => {
    const commUnit = item.commercial_unit ? String(item.commercial_unit).trim().toUpperCase() : 'UN';
    const commQty = Math.max(0, parseFloat(item.commercial_quantity) || 0);
    const commPrice = roundAmount(parseFloat(item.commercial_unit_price) || 0);
    const commTotal = roundAmount(parseFloat(item.commercial_total_price) || (commQty * commPrice) || 0);

    const upp = resolveUnitsPerPackage(item);
    const intUnit = detectBaseUnit(commUnit);
    const intQty = calculateInternalQuantity(commQty, upp);
    const intPrice = calculateInternalUnitPrice(commPrice, upp);

    return {
      product_id: null,
      product_code: item.product_code ? String(item.product_code).trim() : null,
      barcode: item.barcode && item.barcode !== 'SEM GTIN' ? String(item.barcode).trim() : null,
      description: String(item.description).trim(),
      normalized_description: getNormalizedDescription(item.description),
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

      discount: item.discount ? roundAmount(parseFloat(item.discount)) : null,
      uTrib: item.uTrib || null,
      qTrib: item.qTrib || 0,
      vUnTrib: item.vUnTrib || 0
    };
  }) : [];

  return {
    id: invoiceId,
    source_file_name: fileName,
    source_file_type: fileType,
    invoice_key: raw.invoice_key ? raw.invoice_key.replace(/\s+/g, '') : null,
    invoice_number: raw.invoice_number ? String(raw.invoice_number).trim() : null,
    invoice_series: raw.invoice_series ? String(raw.invoice_series).trim() : null,
    order_number: raw.order_number ? String(raw.order_number).trim() : null,
    issue_date: dateStr,
    customer_name: raw.customer_name ? String(raw.customer_name).trim() : 'Revisar Cliente',
    customer_id: null,
    customer_document: formatDocument(raw.customer_document),
    customer_city: raw.customer_city ? String(raw.customer_city).trim() : null,
    customer_state: raw.customer_state ? String(raw.customer_state).trim() : null,
    issuer_name: raw.company_name ? String(raw.company_name).trim() : null,
    issuer_document: formatDocument(raw.company_document),
    total_amount: roundAmount(raw.total_amount || 0),
    products_amount: raw.products_amount ? roundAmount(raw.products_amount) : null,
    discount_amount: raw.discount_amount ? roundAmount(raw.discount_amount) : null,
    shipping_amount: raw.shipping_amount ? roundAmount(raw.shipping_amount) : null,
    status: raw.status || 'review',
    items: normalizedItems,
    raw_xml: raw.raw_xml || null,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
