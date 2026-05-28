// src/repositories/types.ts

export interface Customer {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  total_orders: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  code: string | null;
  barcode: string | null;
  name: string;
  normalized_name: string;
  category: string | null;
  brand: string | null;
  ncm: string | null;
  default_commercial_unit: string | null;
  default_internal_unit: string | null;
  units_per_package: number | null;
  last_package_price: number | null;
  last_internal_unit_price: number | null;
  average_package_price: number | null;
  average_internal_unit_price: number | null;
  min_internal_unit_price: number | null;
  max_internal_unit_price: number | null;
  notes: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  invoice_key: string | null;
  invoice_number: string | null;
  invoice_series: string | null;
  order_number: string | null;
  issue_date: string | null;
  source_file_type: 'xml';
  source_file_name: string;
  total_amount: number;
  products_amount: number | null;
  discount_amount: number | null;
  shipping_amount: number | null;
  status: 'pending' | 'review' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_code: string | null;
  barcode: string | null;
  description: string;
  ncm: string | null;
  cfop: string | null;

  commercial_unit: string | null;
  commercial_quantity: number;
  commercial_unit_price: number;
  commercial_total_price: number;

  units_per_package: number;
  internal_unit: string;
  internal_quantity: number;
  internal_unit_price: number;

  discount: number | null;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  customer_id: string;
  order_id: string;
  order_item_id: string;
  date: string;

  commercial_unit: string | null;
  commercial_quantity: number;
  commercial_unit_price: number;
  commercial_total_price: number;

  units_per_package: number;
  internal_unit: string;
  internal_quantity: number;
  internal_unit_price: number;

  source: 'xml';
  created_at: string;
}

export interface Upload {
  id: string;
  file_name: string;
  file_type: 'xml';
  status: 'pending' | 'processing' | 'review' | 'completed' | 'error';
  error_message: string | null;
  extracted_data: any | null;
  created_at: string;
}

// Normalized extracted structure used by Upload/Review flow
export interface NormalizedInvoice {
  id: string;
  source_file_name: string;
  source_file_type: 'xml';
  invoice_key: string | null;
  invoice_number: string | null;
  invoice_series: string | null;
  order_number: string | null;
  issue_date: string | null;

  customer_id: string | null;
  customer_name: string;
  customer_document: string | null;
  customer_city: string | null;
  customer_state: string | null;

  issuer_name: string | null;
  issuer_document: string | null;

  total_amount: number;
  products_amount: number | null;
  discount_amount: number | null;
  shipping_amount: number | null;

  status: 'pending' | 'review' | 'completed' | 'error';

  items: Array<{
    product_id: string | null;
    product_code: string | null;
    barcode: string | null;
    description: string;
    normalized_description: string;
    ncm: string | null;
    cfop: string | null;

    commercial_unit: string | null;
    commercial_quantity: number;
    commercial_unit_price: number;
    commercial_total_price: number;

    units_per_package: number;
    internal_unit: string;
    internal_quantity: number;
    internal_unit_price: number;
    packaging_requires_review?: boolean;
    packaging_warning?: string | null;
    save_conversion_to_product?: boolean;
    conversion_source?: 'product' | 'description' | 'manual' | null;
    matched_product_name?: string | null;

    discount: number | null;
    
    // Additional raw attributes to help logic
    uTrib?: string | null;
    qTrib?: number;
    vUnTrib?: number;
  }>;

  raw_xml: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';
