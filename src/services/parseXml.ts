// XML Parser service (parseXml.ts)

import type { NormalizedInvoice } from './db';
import { getNormalizedDescription } from './db';

export function parseXmlInvoice(xmlText: string, fileName: string): NormalizedInvoice {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Helper to extract text from a tag
  const getTagValue = (parent: Element | Document, tagName: string): string | null => {
    const el = parent.querySelector(tagName);
    return el ? el.textContent : null;
  };

  // Check if it's a valid NFe/XML
  const chNFe = getTagValue(xmlDoc, 'chNFe') || getTagValue(xmlDoc, 'infNFe[Id]') || null;
  
  // Invoice details
  const invoiceNumber = getTagValue(xmlDoc, 'nNF');
  const issueDateRaw = getTagValue(xmlDoc, 'dhEmi') || getTagValue(xmlDoc, 'dEmi');
  const issueDate = issueDateRaw ? issueDateRaw.split('T')[0] : new Date().toISOString().split('T')[0];

  // Issuer details (Company)
  const emitNode = xmlDoc.querySelector('emit');
  const companyName = emitNode ? getTagValue(emitNode, 'xNome') : null;
  const companyDocument = emitNode ? (getTagValue(emitNode, 'CNPJ') || getTagValue(emitNode, 'CPF')) : null;

  // Customer details (Client)
  const destNode = xmlDoc.querySelector('dest');
  const customerName = destNode ? (getTagValue(destNode, 'xNome') || 'Cliente Consumidor') : 'Consumidor Final';
  const customerDocument = destNode ? (getTagValue(destNode, 'CNPJ') || getTagValue(destNode, 'CPF')) : null;
  
  // Customer address
  const enderDestNode = destNode ? destNode.querySelector('enderDest') : null;
  const customerCity = enderDestNode ? (getTagValue(enderDestNode, 'xMun') || undefined) : undefined;
  const customerState = enderDestNode ? (getTagValue(enderDestNode, 'UF') || undefined) : undefined;

  // Totals
  const totalNode = xmlDoc.querySelector('total ICMSTot');
  const totalAmount = totalNode ? parseFloat(getTagValue(totalNode, 'vNF') || '0') : 0;
  const discountAmount = totalNode ? parseFloat(getTagValue(totalNode, 'vDesc') || '0') : 0;
  const shippingAmount = totalNode ? parseFloat(getTagValue(totalNode, 'vFrete') || '0') : 0;

  // Extract items
  const items: any[] = [];
  const detNodes = xmlDoc.querySelectorAll('det');
  
  detNodes.forEach((det) => {
    const prodNode = det.querySelector('prod');
    if (!prodNode) return;

    const productCode = getTagValue(prodNode, 'cProd');
    const barcode = getTagValue(prodNode, 'cEAN');
    const description = getTagValue(prodNode, 'xProd') || 'Produto sem nome';
    const ncm = getTagValue(prodNode, 'NCM');
    const cfop = getTagValue(prodNode, 'CFOP');
    const quantity = parseFloat(getTagValue(prodNode, 'qCom') || '0');
    const unit = getTagValue(prodNode, 'uCom');
    const unitPrice = parseFloat(getTagValue(prodNode, 'vUnCom') || '0');
    const totalItemPrice = parseFloat(getTagValue(prodNode, 'vProd') || '0');
    const itemDiscount = parseFloat(getTagValue(prodNode, 'vDesc') || '0');

    items.push({
      product_code: productCode,
      barcode: barcode && barcode !== 'SEM GTIN' ? barcode : null,
      description,
      normalized_description: getNormalizedDescription(description),
      ncm,
      cfop,
      quantity,
      unit,
      unit_price: unitPrice,
      total_price: totalItemPrice,
      discount: itemDiscount > 0 ? itemDiscount : null
    });
  });

  return {
    id: `ord-${Math.random().toString(36).substring(2, 9)}`,
    source_file_name: fileName,
    source_file_type: 'xml',
    invoice_key: chNFe,
    invoice_number: invoiceNumber,
    order_number: `PED-${invoiceNumber || 'XML'}`,
    issue_date: issueDate,
    customer_name: customerName,
    customer_document: customerDocument,
    customer_city: customerCity,
    customer_state: customerState,
    company_name: companyName,
    company_document: companyDocument,
    total_amount: totalAmount > 0 ? totalAmount : items.reduce((sum, item) => sum + item.total_price, 0),
    discount_amount: discountAmount > 0 ? discountAmount : null,
    shipping_amount: shippingAmount > 0 ? shippingAmount : null,
    status: 'review', // Defaults to review first
    confidence_score: 1.0, // XML is 100% confidence
    items,
    raw_text: null,
    raw_xml: xmlText,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
