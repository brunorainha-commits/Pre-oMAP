// src/repositories/ProductRepository.ts
import { BaseRepository } from './BaseRepository';
import type { Product } from './types';

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('precomap_products');
  }

  public findByBarcode(barcode: string): Product | undefined {
    return this.getAll().find(p => p.barcode === barcode);
  }

  public findByNormalizedName(normalizedName: string): Product | undefined {
    return this.getAll().find(p => p.normalized_name === normalizedName);
  }

  public findByCode(code: string): Product | undefined {
    return this.getAll().find(p => p.code === code);
  }
}

export const productRepository = new ProductRepository();
