// src/services/db.ts

import {
  customerRepository,
  productRepository,
  orderRepository,
  orderItemRepository,
  priceHistoryRepository,
  uploadRepository
} from '../repositories';

import type {
  Customer,
  Product,
  Order,
  OrderItem,
  PriceHistory,
  Upload,
  NormalizedInvoice,
  UserRole
} from '../repositories/types';

export type {
  Customer,
  Product,
  Order,
  OrderItem,
  PriceHistory,
  Upload,
  NormalizedInvoice,
  UserRole
} from '../repositories';

// Utility functions
export function getNormalizedDescription(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ' ') // replace symbols with spaces
    .replace(/\s+/g, ' ') // remove extra spaces
    .trim();
}

export const db = {
  // Configs
  getUserRole(): UserRole {
    return (localStorage.getItem('precomap_user_role') as UserRole) || 'admin';
  },
  
  setUserRole(role: UserRole): void {
    localStorage.setItem('precomap_user_role', role);
  },

  // Facade wrappers
  getCustomers(): Customer[] {
    return customerRepository.getAll();
  },

  getCustomerById(id: string): Customer | undefined {
    return customerRepository.getById(id);
  },

  saveCustomer(customer: Customer): void {
    customerRepository.upsert(customer);
  },

  deleteCustomer(id: string): void {
    customerRepository.delete(id);
  },

  getProducts(): Product[] {
    return productRepository.getAll();
  },

  getProductById(id: string): Product | undefined {
    return productRepository.getById(id);
  },

  saveProduct(product: Product): void {
    productRepository.upsert(product);
  },

  deleteProduct(id: string): void {
    productRepository.delete(id);
  },

  getOrders(): Order[] {
    return orderRepository.getAll();
  },

  getOrderById(id: string): Order | undefined {
    return orderRepository.getById(id);
  },

  saveOrder(order: Order): void {
    orderRepository.upsert(order);
  },

  deleteOrder(id: string): void {
    orderRepository.delete(id);
  },

  getOrderItems(): OrderItem[] {
    return orderItemRepository.getAll();
  },

  getOrderItemsByOrder(orderId: string): OrderItem[] {
    return orderItemRepository.getByOrderId(orderId);
  },

  getPriceHistory(): PriceHistory[] {
    return priceHistoryRepository.getAll();
  },

  getPriceHistoryByProduct(productId: string): PriceHistory[] {
    return priceHistoryRepository.getByProductId(productId);
  },

  getPriceHistoryByProductAndCustomer(productId: string, customerId: string): PriceHistory[] {
    return priceHistoryRepository.getAll().filter(ph => 
      ph.product_id === productId && ph.customer_id === customerId
    );
  },

  getUploads(): Upload[] {
    return uploadRepository.getAll();
  },

  saveUpload(upload: Upload): void {
    uploadRepository.upsert(upload);
  },

  // Big Import Function
  importInvoice(invoice: NormalizedInvoice): Order {
    const now = new Date().toISOString();

    // 1. Process Customer
    let customer = customerRepository.findByDocument(invoice.customer_document || '');
    if (!customer) {
      customer = customerRepository.findByName(invoice.customer_name);
    }

    if (!customer) {
      customer = {
        id: `cust-${Math.random().toString(36).substring(2, 9)}`,
        name: invoice.customer_name,
        document: invoice.customer_document,
        email: null,
        phone: null,
        city: invoice.customer_city,
        state: invoice.customer_state,
        notes: null,
        first_purchase_date: null,
        last_purchase_date: null,
        total_orders: 0,
        total_amount: 0,
        created_at: now,
        updated_at: now
      };
      customerRepository.create(customer);
    }

    // 2. Process Order
    const orderId = `ord-${Math.random().toString(36).substring(2, 9)}`;
    const newOrder: Order = {
      id: orderId,
      customer_id: customer.id,
      invoice_key: invoice.invoice_key,
      invoice_number: invoice.invoice_number,
      invoice_series: invoice.invoice_series,
      order_number: invoice.order_number || `PED-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      issue_date: invoice.issue_date,
      source_file_type: 'xml',
      source_file_name: invoice.source_file_name,
      total_amount: invoice.total_amount,
      products_amount: invoice.products_amount,
      discount_amount: invoice.discount_amount,
      shipping_amount: invoice.shipping_amount,
      status: 'completed',
      created_at: now,
      updated_at: now
    };
    orderRepository.upsert(newOrder);

    // 3. Process Items and Products
    invoice.items.forEach(item => {
      // Find or create product
      const itemNormName = item.normalized_description;
      let product = productRepository.findByBarcode(item.barcode || '');
      if (!product && item.product_code) {
        product = productRepository.findByCode(item.product_code);
      }
      if (!product) {
        product = productRepository.findByNormalizedName(itemNormName);
      }
      if (!product) {
        product = {
          id: `prod-${Math.random().toString(36).substring(2, 9)}`,
          code: item.product_code,
          barcode: item.barcode,
          name: item.description,
          normalized_name: itemNormName,
          category: null,
          brand: null,
          ncm: item.ncm,
          default_commercial_unit: item.commercial_unit,
          default_internal_unit: item.internal_unit,
          units_per_package: item.units_per_package,
          last_package_price: item.commercial_unit_price,
          last_internal_unit_price: item.internal_unit_price,
          average_package_price: item.commercial_unit_price,
          average_internal_unit_price: item.internal_unit_price,
          min_internal_unit_price: item.internal_unit_price,
          max_internal_unit_price: item.internal_unit_price,
          notes: null,
          first_seen_at: now,
          last_seen_at: now,
          created_at: now,
          updated_at: now
        };
      } else {
        // Update product statistics
        product.last_package_price = item.commercial_unit_price;
        product.last_internal_unit_price = item.internal_unit_price;
        if (!product.min_internal_unit_price || item.internal_unit_price < product.min_internal_unit_price) {
          product.min_internal_unit_price = item.internal_unit_price;
        }
        if (!product.max_internal_unit_price || item.internal_unit_price > product.max_internal_unit_price) {
          product.max_internal_unit_price = item.internal_unit_price;
        }
        product.last_seen_at = now;
        product.updated_at = now;
      }
      productRepository.upsert(product);

      // Create Order Item
      const orderItem: OrderItem = {
        id: `oi-${Math.random().toString(36).substring(2, 9)}`,
        order_id: newOrder.id,
        product_id: product.id,
        product_code: item.product_code,
        barcode: item.barcode,
        description: item.description,
        ncm: item.ncm,
        cfop: item.cfop,

        commercial_unit: item.commercial_unit,
        commercial_quantity: item.commercial_quantity,
        commercial_unit_price: item.commercial_unit_price,
        commercial_total_price: item.commercial_total_price,

        units_per_package: item.units_per_package,
        internal_unit: item.internal_unit,
        internal_quantity: item.internal_quantity,
        internal_unit_price: item.internal_unit_price,

        discount: item.discount,
        created_at: now
      };
      orderItemRepository.upsert(orderItem);

      // Create Price History
      const priceHistory: PriceHistory = {
        id: `ph-${Math.random().toString(36).substring(2, 9)}`,
        product_id: product.id,
        customer_id: customer!.id,
        order_id: newOrder.id,
        order_item_id: orderItem.id,
        date: invoice.issue_date || now,

        commercial_unit: item.commercial_unit,
        commercial_quantity: item.commercial_quantity,
        commercial_unit_price: item.commercial_unit_price,
        commercial_total_price: item.commercial_total_price,

        units_per_package: item.units_per_package,
        internal_unit: item.internal_unit,
        internal_quantity: item.internal_quantity,
        internal_unit_price: item.internal_unit_price,

        source: 'xml',
        created_at: now
      };
      priceHistoryRepository.upsert(priceHistory);
    });

    // 4. Recalculate statistics
    this.recalculateAllStats();

    return newOrder;
  },

  recalculateAllStats() {
    const customers = customerRepository.getAll();
    const products = productRepository.getAll();
    const orders = orderRepository.getAll();
    const priceHistories = priceHistoryRepository.getAll();

    // 1. Recalculate Customer stats
    customers.forEach(cust => {
      const custOrders = orders.filter(o => o.customer_id === cust.id);
      if (custOrders.length === 0) {
        cust.total_orders = 0;
        cust.total_amount = 0;
        cust.first_purchase_date = null;
        cust.last_purchase_date = null;
      } else {
        cust.total_orders = custOrders.length;
        cust.total_amount = custOrders.reduce((sum, o) => sum + o.total_amount, 0);

        const dates = custOrders
          .map(o => o.issue_date)
          .filter(d => !!d)
          .sort() as string[];
        
        cust.first_purchase_date = dates[0] || null;
        cust.last_purchase_date = dates[dates.length - 1] || null;
      }
      cust.updated_at = new Date().toISOString();
      customerRepository.upsert(cust);
    });

    // 2. Recalculate Product stats
    products.forEach(prod => {
      const prodHistory = priceHistories.filter(ph => ph.product_id === prod.id);
      if (prodHistory.length === 0) {
        prod.first_seen_at = null;
        prod.last_seen_at = null;
        prod.average_package_price = null;
        prod.average_internal_unit_price = null;
      } else {
        const dates = prodHistory
          .map(ph => ph.date)
          .filter(d => !!d)
          .sort() as string[];

        prod.first_seen_at = dates[0] || null;
        prod.last_seen_at = dates[dates.length - 1] || null;

        const sumPkg = prodHistory.reduce((sum, ph) => sum + ph.commercial_unit_price, 0);
        prod.average_package_price = sumPkg / prodHistory.length;

        const sumInt = prodHistory.reduce((sum, ph) => sum + ph.internal_unit_price, 0);
        prod.average_internal_unit_price = sumInt / prodHistory.length;
      }
      prod.updated_at = new Date().toISOString();
      productRepository.upsert(prod);
    });
  },

  wipeDatabase() {
    customerRepository.clear();
    productRepository.clear();
    orderRepository.clear();
    orderItemRepository.clear();
    priceHistoryRepository.clear();
    uploadRepository.clear();
  }
};


