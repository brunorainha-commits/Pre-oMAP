// src/repositories/OrderRepository.ts
import { BaseRepository } from './BaseRepository';
import type { Order } from './types';

export class OrderRepository extends BaseRepository<Order> {
  constructor() {
    super('precomap_orders');
  }

  public findByInvoiceKey(key: string): Order | undefined {
    return this.getAll().find(o => o.invoice_key === key);
  }

  public findByNumberAndCustomerAndDate(invoiceNumber: string, customerId: string, issueDate: string): Order | undefined {
    return this.getAll().find(o => 
      o.invoice_number === invoiceNumber && 
      o.customer_id === customerId && 
      o.issue_date === issueDate
    );
  }
}

export const orderRepository = new OrderRepository();
