import type { Product } from '../repositories/types';

interface ProductMatchInput {
  product_code?: string | null;
  barcode?: string | null;
  description?: string | null;
  normalized_description?: string | null;
}

export function normalizeProductCode(value: string | null | undefined): string {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function normalizeBarcode(value: string | null | undefined): string {
  const normalized = String(value || '').replace(/\D/g, '');
  if (!normalized || /^0+$/.test(normalized)) return '';
  return normalized;
}

export function normalizeProductName(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactName(value: string): string {
  return value.replace(/\s+/g, '');
}

function significantTokens(value: string): string[] {
  const ignored = new Set(['cx', 'cxa', 'caixa', 'fd', 'fardo', 'pct', 'pacote', 'pack', 'emb', 'un', 'und', 'com', 'de', 'da', 'do', 'para']);
  return value
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !ignored.has(token));
}

function hasStrongNameSimilarity(inputName: string, productName: string): boolean {
  const inputTokens = significantTokens(inputName);
  const productTokens = significantTokens(productName);
  if (inputTokens.length < 3 || productTokens.length < 3) return false;

  const productTokenSet = new Set(productTokens);
  const sharedTokens = inputTokens.filter(token => productTokenSet.has(token)).length;
  const smallerTokenCount = Math.min(inputTokens.length, productTokens.length);

  return sharedTokens >= 3 && sharedTokens / smallerTokenCount >= 0.85;
}

export function findBestMatchingProduct(products: Product[], input: ProductMatchInput): Product | undefined {
  const itemBarcode = normalizeBarcode(input.barcode);
  if (itemBarcode) {
    const byBarcode = products.find(product => normalizeBarcode(product.barcode) === itemBarcode);
    if (byBarcode) return byBarcode;
  }

  const itemCode = normalizeProductCode(input.product_code);
  if (itemCode) {
    const byCode = products.find(product => normalizeProductCode(product.code) === itemCode);
    if (byCode) return byCode;
  }

  const itemName = normalizeProductName(input.normalized_description || input.description);
  if (!itemName) return undefined;

  const byExactName = products.find(product => normalizeProductName(product.normalized_name || product.name) === itemName);
  if (byExactName) return byExactName;

  const compactItemName = compactName(itemName);
  const byCompactName = products.find(product => compactName(normalizeProductName(product.normalized_name || product.name)) === compactItemName);
  if (byCompactName) return byCompactName;

  return products.find(product => hasStrongNameSimilarity(itemName, normalizeProductName(product.normalized_name || product.name)));
}
