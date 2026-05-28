// src/repositories/CustomerRepository.ts
import { BaseRepository } from './BaseRepository';
import type { Customer } from './types';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('precomap_customers');
  }

  public findByDocument(document: string): Customer | undefined {
    const cleanDoc = document.replace(/\D/g, '');
    return this.getAll().find(c => c.document && c.document.replace(/\D/g, '') === cleanDoc);
  }

  public findByName(name: string): Customer | undefined {
    const n = name.toLowerCase().trim();
    return this.getAll().find(c => c.name.toLowerCase().trim() === n);
  }
}

export const customerRepository = new CustomerRepository();
