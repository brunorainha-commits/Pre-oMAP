// src/repositories/OrderItemRepository.ts
import { BaseRepository } from './BaseRepository';
import type { OrderItem } from './types';

export class OrderItemRepository extends BaseRepository<OrderItem> {
  constructor() {
    super('precomap_order_items');
  }

  public getByOrderId(orderId: string): OrderItem[] {
    return this.getAll().filter(item => item.order_id === orderId);
  }

  public getByProductId(productId: string): OrderItem[] {
    return this.getAll().filter(item => item.product_id === productId);
  }
}

export const orderItemRepository = new OrderItemRepository();
