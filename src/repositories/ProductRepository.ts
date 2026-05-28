// src/repositories/ProductRepository.ts
import { BaseRepository } from './BaseRepository';
import type { Product } from './types';
import { findBestMatchingProduct, normalizeBarcode, normalizeProductCode, normalizeProductName } from '../services/productMatcher';

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('precomap_products');
  }

  public findByBarcode(barcode: string): Product | undefined {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) return undefined;
    return this.getAll().find(p => normalizeBarcode(p.barcode) === normalizedBarcode);
  }

  public findByNormalizedName(normalizedName: string): Product | undefined {
    const targetName = normalizeProductName(normalizedName);
    if (!targetName) return undefined;
    return this.getAll().find(p => normalizeProductName(p.normalized_name || p.name) === targetName);
  }

  public findByCode(code: string): Product | undefined {
    const normalizedCode = normalizeProductCode(code);
    if (!normalizedCode) return undefined;
    return this.getAll().find(p => normalizeProductCode(p.code) === normalizedCode);
  }

  public findBestMatchForItem(item: {
    product_code?: string | null;
    barcode?: string | null;
    description?: string | null;
    normalized_description?: string | null;
  }): Product | undefined {
    return findBestMatchingProduct(this.getAll(), item);
  }
}

export const productRepository = new ProductRepository();
