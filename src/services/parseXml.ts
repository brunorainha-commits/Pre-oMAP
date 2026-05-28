// XML Parser service (parseXml.ts)

import type { NormalizedInvoice } from './db';
import { getNormalizedDescription } from './db';

// Helper to query element by local name, ignoring namespaces
const getElementByLocalName = (parent: Element | Document, localName: string): Element | null => {
  // Try standard lookup first
  const elements = parent.getElementsByTagName(localName);
  if (elements.length > 0) return elements[0];
  
  // Fallback to suffix matching for namespaced tags
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const name = el.tagName;
    if (name === localName || name.endsWith(':' + localName)) {
      return el;
    }
  }
  return null;
};

// Helper to query all elements by local name, ignoring namespaces
const getAllElementsByLocalName = (parent: Element | Document, localName: string): Element[] => {
  const elements = parent.getElementsByTagName(localName);
  if (elements.length > 0) return Array.from(elements);
  
  const results: Element[] = [];
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const name = el.tagName;
    if (name === localName || name.endsWith(':' + localName)) {
      results.push(el);
    }
  }
  return results;
};

// Helper to extract text value of a tag by local name
const getTagValueByLocalName = (parent: Element | Document, localName: string): string | null => {
  const el = getElementByLocalName(parent, localName);
  return el ? el.textContent : null;
};

export function parseXmlInvoice(xmlText: string, fileName: string): NormalizedInvoice {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('O arquivo XML fornecido é inválido ou está mal formatado. Não foi possível realizar o parsing estruturado.');
  }

  // Check if it's a valid NFe/XML (has infNFe tag)
  const infNFe = getElementByLocalName(xmlDoc, 'infNFe');
  if (!infNFe && !getElementByLocalName(xmlDoc, 'nfeProc') && !getElementByLocalName(xmlDoc, 'NFe')) {
    throw new Error('O arquivo XML carregado não corresponde a um layout válido de Nota Fiscal Eletrônica (NF-e ou NFC-e).');
  }

  // Invoice access key
  let chNFe = getTagValueByLocalName(xmlDoc, 'chNFe');
  if (!chNFe) {
    // Try to extract from infNFe Id attribute (e.g. Id="NFe35190900000000000000550010000000011000000018")
    const infNFeEl = getElementByLocalName(xmlDoc, 'infNFe');
    if (infNFeEl) {
      const idAttr = infNFeEl.getAttribute('Id');
      if (idAttr && idAttr.startsWith('NFe')) {
        chNFe = idAttr.substring(3);
      }
    }
  }
  
  // Invoice number
  const invoiceNumber = getTagValueByLocalName(xmlDoc, 'nNF');
  const issueDateRaw = getTagValueByLocalName(xmlDoc, 'dhEmi') || getTagValueByLocalName(xmlDoc, 'dEmi');
  const issueDate = issueDateRaw ? issueDateRaw.split('T')[0] : new Date().toISOString().split('T')[0];

  // Issuer details (Company)
  const emitNode = getElementByLocalName(xmlDoc, 'emit');
  const companyName = emitNode ? getTagValueByLocalName(emitNode, 'xNome') : null;
  const companyDocument = emitNode ? (getTagValueByLocalName(emitNode, 'CNPJ') || getTagValueByLocalName(emitNode, 'CPF')) : null;

  // Customer details (Client)
  const destNode = getElementByLocalName(xmlDoc, 'dest');
  const customerName = destNode ? (getTagValueByLocalName(destNode, 'xNome') || 'Cliente Consumidor') : 'Consumidor Final';
  const customerDocument = destNode ? (getTagValueByLocalName(destNode, 'CNPJ') || getTagValueByLocalName(destNode, 'CPF')) : null;
  
  // Customer address
  const enderDestNode = destNode ? getElementByLocalName(destNode, 'enderDest') : null;
  const customerCity = enderDestNode ? (getTagValueByLocalName(enderDestNode, 'xMun') || null) : null;
  const customerState = enderDestNode ? (getTagValueByLocalName(enderDestNode, 'UF') || null) : null;

  // Totals
  const totalNode = getElementByLocalName(xmlDoc, 'ICMSTot');
  const totalAmount = totalNode ? parseFloat(getTagValueByLocalName(totalNode, 'vNF') || '0') : 0;
  const discountAmount = totalNode ? parseFloat(getTagValueByLocalName(totalNode, 'vDesc') || '0') : 0;
  const shippingAmount = totalNode ? parseFloat(getTagValueByLocalName(totalNode, 'vFrete') || '0') : 0;

  // Extract items
  const items: any[] = [];
  const detNodes = getAllElementsByLocalName(xmlDoc, 'det');
  
  detNodes.forEach((det) => {
    const prodNode = getElementByLocalName(det, 'prod');
    if (!prodNode) return;

    const productCode = getTagValueByLocalName(prodNode, 'cProd');
    const barcode = getTagValueByLocalName(prodNode, 'cEAN');
    const description = getTagValueByLocalName(prodNode, 'xProd') || 'Produto sem nome';
    const ncm = getTagValueByLocalName(prodNode, 'NCM');
    const cfop = getTagValueByLocalName(prodNode, 'CFOP');
    const quantity = parseFloat(getTagValueByLocalName(prodNode, 'qCom') || '0');
    const unit = getTagValueByLocalName(prodNode, 'uCom');
    const unitPrice = parseFloat(getTagValueByLocalName(prodNode, 'vUnCom') || '0');
    const totalItemPrice = parseFloat(getTagValueByLocalName(prodNode, 'vProd') || '0');
    const itemDiscount = parseFloat(getTagValueByLocalName(prodNode, 'vDesc') || '0');

    const uTrib = getTagValueByLocalName(prodNode, 'uTrib');
    const qTrib = parseFloat(getTagValueByLocalName(prodNode, 'qTrib') || '0');
    const vUnTrib = parseFloat(getTagValueByLocalName(prodNode, 'vUnTrib') || '0');

    items.push({
      product_code: productCode,
      barcode: barcode && barcode !== 'SEM GTIN' ? barcode : null,
      description,
      normalized_description: getNormalizedDescription(description),
      ncm,
      cfop,
      
      commercial_unit: unit,
      commercial_quantity: quantity,
      commercial_unit_price: unitPrice,
      commercial_total_price: totalItemPrice,
      
      uTrib,
      qTrib,
      vUnTrib,
      
      discount: itemDiscount > 0 ? itemDiscount : null,
      product_id: null,
      internal_unit: unit || 'UN',
      internal_quantity: quantity,
      internal_unit_price: unitPrice,
      units_per_package: 1
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
    issuer_name: companyName,
    issuer_document: companyDocument,
    total_amount: totalAmount > 0 ? totalAmount : items.reduce((sum, item) => sum + item.commercial_total_price, 0),
    products_amount: totalAmount > 0 ? totalAmount : null,
    discount_amount: discountAmount > 0 ? discountAmount : null,
    shipping_amount: shippingAmount > 0 ? shippingAmount : null,
    status: 'review',
    items,
    invoice_series: null,
    customer_id: null,
    raw_xml: xmlText,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
