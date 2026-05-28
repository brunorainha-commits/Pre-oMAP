// Normalizer service (normalizer.ts)

import type { NormalizedInvoice } from './db';
import { getNormalizedDescription } from './db';


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

// Primary normalization function
export function normalizeInvoiceData(raw: any, fileType: 'xml' | 'pdf', fileName: string): NormalizedInvoice {
  const invoiceId = raw.id || `ord-${Math.random().toString(36).substring(2, 9)}`;
  const dateStr = raw.issue_date || new Date().toISOString().split('T')[0];

  return {
    id: invoiceId,
    source_file_name: fileName,
    source_file_type: fileType,
    invoice_key: raw.invoice_key ? raw.invoice_key.replace(/\s+/g, '') : null,
    invoice_number: raw.invoice_number ? String(raw.invoice_number).trim() : null,
    order_number: raw.order_number ? String(raw.order_number).trim() : null,
    issue_date: dateStr,
    customer_name: raw.customer_name ? String(raw.customer_name).trim() : 'Revisar Cliente',
    customer_document: formatDocument(raw.customer_document),
    customer_city: raw.customer_city ? String(raw.customer_city).trim() : undefined,
    customer_state: raw.customer_state ? String(raw.customer_state).trim() : undefined,
    company_name: raw.company_name ? String(raw.company_name).trim() : null,
    company_document: formatDocument(raw.company_document),
    total_amount: roundAmount(raw.total_amount || 0),
    discount_amount: raw.discount_amount ? roundAmount(raw.discount_amount) : null,
    shipping_amount: raw.shipping_amount ? roundAmount(raw.shipping_amount) : null,
    status: raw.status || 'review',
    confidence_score: raw.confidence_score !== undefined ? raw.confidence_score : (fileType === 'xml' ? 1.0 : 0.5),
    items: Array.isArray(raw.items) ? raw.items.map((item: any) => ({
      product_code: item.product_code ? String(item.product_code).trim() : null,
      barcode: item.barcode && item.barcode !== 'SEM GTIN' ? String(item.barcode).trim() : null,
      description: String(item.description).trim(),
      normalized_description: getNormalizedDescription(item.description),
      ncm: item.ncm ? String(item.ncm).trim() : null,
      cfop: item.cfop ? String(item.cfop).trim() : null,
      quantity: Math.max(0, parseFloat(item.quantity) || 0),
      unit: item.unit ? String(item.unit).trim().toUpperCase() : 'UN',
      unit_price: roundAmount(parseFloat(item.unit_price) || 0),
      total_price: roundAmount(parseFloat(item.total_price) || (parseFloat(item.quantity) * parseFloat(item.unit_price)) || 0),
      discount: item.discount ? roundAmount(parseFloat(item.discount)) : null
    })) : [],
    raw_text: raw.raw_text || null,
    raw_xml: raw.raw_xml || null,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
