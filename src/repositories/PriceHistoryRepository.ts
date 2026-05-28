// src/repositories/PriceHistoryRepository.ts
import { BaseRepository } from './BaseRepository';
import type { PriceHistory } from './types';

export class PriceHistoryRepository extends BaseRepository<PriceHistory> {
  constructor() {
    super('precomap_price_history');
  }

  public getByProductId(productId: string): PriceHistory[] {
    return this.getAll().filter(ph => ph.product_id === productId);
  }

  public getByCustomerId(customerId: string): PriceHistory[] {
    return this.getAll().filter(ph => ph.customer_id === customerId);
  }
}

export const priceHistoryRepository = new PriceHistoryRepository();
