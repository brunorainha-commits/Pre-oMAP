// database service (db.ts)

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
  unit: string | null;
  ncm: string | null;
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
  order_number: string | null;
  issue_date: string | null;
  source_file_type: 'xml' | 'pdf';
  source_file_name: string;
  total_amount: number;
  discount_amount: number | null;
  shipping_amount: number | null;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_code: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total_price: number;
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
  unit_price: number;
  quantity: number;
  total_price: number;
  source: 'xml' | 'pdf';
  created_at: string;
}

export interface Upload {
  id: string;
  file_name: string;
  file_type: 'xml' | 'pdf';
  file_url: string | null;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'error';
  error_message: string | null;
  extracted_data: any | null;
  created_at: string;
}

export interface NormalizedInvoice {
  id: string;
  source_file_name: string;
  source_file_type: 'xml' | 'pdf';
  invoice_key: string | null;
  invoice_number: string | null;
  order_number: string | null;
  issue_date: string | null;
  customer_name: string;
  customer_document: string | null;
  customer_city?: string;
  customer_state?: string;
  company_name: string | null;
  company_document: string | null;
  total_amount: number;
  discount_amount: number | null;
  shipping_amount: number | null;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'error';
  confidence_score: number | null;
  items: Array<{
    product_code: string | null;
    barcode: string | null;
    description: string;
    normalized_description: string;
    ncm: string | null;
    cfop: string | null;
    quantity: number;
    unit: string | null;
    unit_price: number;
    total_price: number;
    discount: number | null;
  }>;
  raw_text: string | null;
  raw_xml: string | null;
  created_at: string;
  updated_at: string;
}

// Global state profile
export type UserRole = 'admin' | 'operator' | 'viewer';

const STORAGE_KEYS = {
  CUSTOMERS: 'ubbe_track_customers',
  PRODUCTS: 'ubbe_track_products',
  ORDERS: 'ubbe_track_orders',
  ORDER_ITEMS: 'ubbe_track_order_items',
  PRICE_HISTORY: 'ubbe_track_price_history',
  UPLOADS: 'ubbe_track_uploads',
  USER_ROLE: 'ubbe_track_user_role'
};

// Heuristic to normalize product description for matching
export function getNormalizedDescription(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '') // remove special chars
    .replace(/\s+/g, ' ') // single space
    .trim();
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    console.error(`Error parsing key ${key} from localStorage`, e);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Generate premium mock data if localStorage is empty
function checkAndInitializeMockData() {
  const check = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (check && JSON.parse(check).length > 0) return; // already initialized

  console.log("Initializing database with realistic mock data...");

  // Mock Customers
  const customers: Customer[] = [
    {
      id: 'cust-1',
      name: 'Supermercados Pão e Trigo Ltda',
      document: '42.312.876/0001-44',
      email: 'financeiro@paotrigo.com.br',
      phone: '(11) 3244-9988',
      city: 'São Paulo',
      state: 'SP',
      notes: 'Cliente premium, compras recorrentes de insumos de panificação.',
      first_purchase_date: '2026-01-10',
      last_purchase_date: '2026-05-20',
      total_orders: 4,
      total_amount: 19850.00,
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-05-20T16:00:00Z'
    },
    {
      id: 'cust-2',
      name: 'Distribuidora Aliança de Alimentos',
      document: '18.992.404/0001-89',
      email: 'compras@alianca.com.br',
      phone: '(21) 2505-1234',
      city: 'Rio de Janeiro',
      state: 'RJ',
      notes: 'Distribuidor grande. Altamente sensível a flutuações de preços.',
      first_purchase_date: '2026-02-15',
      last_purchase_date: '2026-05-25',
      total_orders: 3,
      total_amount: 28400.00,
      created_at: '2026-02-15T09:00:00Z',
      updated_at: '2026-05-25T14:30:00Z'
    },
    {
      id: 'cust-3',
      name: 'Hortifruti Da Terra Eireli',
      document: '07.211.555/0001-10',
      email: ' hortifruti@daterra.com.br',
      phone: '(19) 3871-2299',
      city: 'Campinas',
      state: 'SP',
      notes: 'Pagamentos pontuais. Compra hortifruti e sacos de polietileno.',
      first_purchase_date: '2026-03-01',
      last_purchase_date: '2026-05-18',
      total_orders: 3,
      total_amount: 8120.00,
      created_at: '2026-03-01T14:00:00Z',
      updated_at: '2026-05-18T10:15:00Z'
    },
    {
      id: 'cust-4',
      name: 'Restaurante Sabor & Arte Ltda',
      document: '29.333.111/0001-32',
      email: 'contato@saboresarte.com.br',
      phone: '(31) 3499-8877',
      city: 'Belo Horizonte',
      state: 'MG',
      notes: 'Restaurante gourmet. Exige alto controle de qualidade.',
      first_purchase_date: '2026-02-20',
      last_purchase_date: '2026-04-10',
      total_orders: 2,
      total_amount: 5400.00,
      created_at: '2026-02-20T11:00:00Z',
      updated_at: '2026-04-10T12:00:00Z'
    },
    {
      id: 'cust-5',
      name: 'Lanchonete Central de Suzano',
      document: '99.888.777/0001-66',
      email: 'central@suzanolanches.com.br',
      phone: '(11) 4744-1122',
      city: 'Suzano',
      state: 'SP',
      notes: 'Cliente de pequeno porte. Não realiza compras há mais de 45 dias.',
      first_purchase_date: '2026-01-15',
      last_purchase_date: '2026-03-05',
      total_orders: 2,
      total_amount: 3200.00,
      created_at: '2026-01-15T08:30:00Z',
      updated_at: '2026-03-05T15:00:00Z'
    }
  ];

  // Mock Products
  const products: Product[] = [
    {
      id: 'prod-1',
      code: 'INS-001',
      barcode: '7891020304051',
      name: 'Farinha de Trigo Especial 25kg',
      normalized_name: getNormalizedDescription('Farinha de Trigo Especial 25kg'),
      category: 'Ingredientes',
      brand: 'Dona Benta',
      unit: 'SC',
      ncm: '1101.00.10',
      notes: 'Insumo básico. Variação constante devido ao mercado de trigo.',
      first_seen_at: '2026-01-10',
      last_seen_at: '2026-05-25',
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-05-25T14:30:00Z'
    },
    {
      id: 'prod-2',
      code: 'INS-002',
      barcode: '7891020304068',
      name: 'Açúcar Refinado Especial 50kg',
      normalized_name: getNormalizedDescription('Açúcar Refinado Especial 50kg'),
      category: 'Ingredientes',
      brand: 'União',
      unit: 'SC',
      ncm: '1701.99.00',
      notes: 'Item de alto volume.',
      first_seen_at: '2026-01-10',
      last_seen_at: '2026-05-25',
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-05-25T14:30:00Z'
    },
    {
      id: 'prod-3',
      code: 'INS-003',
      barcode: '7891020304075',
      name: 'Óleo de Soja Refinado Galão 18L',
      normalized_name: getNormalizedDescription('Óleo de Soja Refinado Galão 18L'),
      category: 'Ingredientes',
      brand: 'Soya',
      unit: 'GL',
      ncm: '1507.90.11',
      notes: 'Teve grandes oscilações de preço no último mês (+14.5%).',
      first_seen_at: '2026-01-10',
      last_seen_at: '2026-05-25',
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-05-25T14:30:00Z'
    },
    {
      id: 'prod-4',
      code: 'EMB-020',
      barcode: '7898887776655',
      name: 'Saco Plástico Transparente 40x60 (C/100)',
      normalized_name: getNormalizedDescription('Saco Plástico Transparente 40x60 (C/100)'),
      category: 'Embalagens',
      brand: 'Plastil',
      unit: 'PCT',
      ncm: '3923.21.90',
      notes: 'Embalagem resistente para expedição.',
      first_seen_at: '2026-01-15',
      last_seen_at: '2026-05-20',
      created_at: '2026-01-15T08:30:00Z',
      updated_at: '2026-05-20T16:00:00Z'
    },
    {
      id: 'prod-5',
      code: 'INS-015',
      barcode: '7891122334455',
      name: 'Fermento Biológico Seco 500g',
      normalized_name: getNormalizedDescription('Fermento Biológico Seco 500g'),
      category: 'Ingredientes',
      brand: 'Fleischmann',
      unit: 'UN',
      ncm: '2102.10.10',
      notes: 'Fermento ativo de alta performance.',
      first_seen_at: '2026-01-10',
      last_seen_at: '2026-05-20',
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-05-20T16:00:00Z'
    },
    {
      id: 'prod-6',
      code: 'INS-009',
      barcode: '7893344556677',
      name: 'Sal Refinado Iodado 25kg',
      normalized_name: getNormalizedDescription('Sal Refinado Iodado 25kg'),
      category: 'Ingredientes',
      brand: 'Cisne',
      unit: 'SC',
      ncm: '2501.00.11',
      notes: 'Estável com baixa flutuação.',
      first_seen_at: '2026-01-15',
      last_seen_at: '2026-04-10',
      created_at: '2026-01-15T08:30:00Z',
      updated_at: '2026-04-10T12:00:00Z'
    },
    {
      id: 'prod-7',
      code: 'HIG-001',
      barcode: '7894455667788',
      name: 'Detergente Neutro Concentrado 5L',
      normalized_name: getNormalizedDescription('Detergente Neutro Concentrado 5L'),
      category: 'Higiene',
      brand: 'Limpol',
      unit: 'GL',
      ncm: '3402.20.00',
      notes: 'Uso interno/higiene do estabelecimento.',
      first_seen_at: '2026-02-20',
      last_seen_at: '2026-04-10',
      created_at: '2026-02-20T11:00:00Z',
      updated_at: '2026-04-10T12:00:00Z'
    }
  ];

  // Orders, Items, Price History and Uploads list
  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];
  const priceHistory: PriceHistory[] = [];
  const uploads: Upload[] = [];

  // Generate historical orders
  interface MockInvoiceDef {
    id: string;
    customer_id: string;
    date: string;
    number: string;
    items: Array<{
      product_id: string;
      qty: number;
      price: number;
    }>;
    discount?: number;
    shipping?: number;
    type: 'xml' | 'pdf';
  }

  const mockInvoices: MockInvoiceDef[] = [
    // January
    {
      id: 'ord-101',
      customer_id: 'cust-1',
      date: '2026-01-10',
      number: '4820',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 10, price: 95.00 }, // wheat
        { product_id: 'prod-2', qty: 5, price: 140.00 }, // sugar
        { product_id: 'prod-5', qty: 20, price: 18.00 }  // yeast
      ],
      discount: 50.00,
      shipping: 100.00
    },
    {
      id: 'ord-102',
      customer_id: 'cust-5',
      date: '2026-01-15',
      number: '12401',
      type: 'pdf',
      items: [
        { product_id: 'prod-1', qty: 2, price: 98.00 },
        { product_id: 'prod-4', qty: 10, price: 12.00 },
        { product_id: 'prod-6', qty: 1, price: 40.00 }
      ],
      shipping: 30.00
    },
    // February
    {
      id: 'ord-103',
      customer_id: 'cust-2',
      date: '2026-02-15',
      number: '4899',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 50, price: 92.00 }, // wheat cheaper for bulk
        { product_id: 'prod-2', qty: 30, price: 135.00 },
        { product_id: 'prod-3', qty: 15, price: 110.00 }  // oil
      ],
      discount: 200.00,
      shipping: 250.00
    },
    {
      id: 'ord-104',
      customer_id: 'cust-4',
      date: '2026-02-20',
      number: '12455',
      type: 'pdf',
      items: [
        { product_id: 'prod-2', qty: 5, price: 142.00 },
        { product_id: 'prod-3', qty: 4, price: 118.00 },
        { product_id: 'prod-7', qty: 10, price: 25.00 }
      ],
      shipping: 50.00
    },
    // March
    {
      id: 'ord-105',
      customer_id: 'cust-3',
      date: '2026-03-01',
      number: '4955',
      type: 'xml',
      items: [
        { product_id: 'prod-4', qty: 50, price: 11.50 },
        { product_id: 'prod-6', qty: 5, price: 42.00 }
      ],
      shipping: 60.00
    },
    {
      id: 'ord-106',
      customer_id: 'cust-5',
      date: '2026-03-05',
      number: '12499',
      type: 'pdf',
      items: [
        { product_id: 'prod-1', qty: 5, price: 105.00 }, // wheat went up!
        { product_id: 'prod-2', qty: 10, price: 145.00 },
        { product_id: 'prod-5', qty: 10, price: 19.50 }
      ],
      discount: 40.00,
      shipping: 40.00
    },
    {
      id: 'ord-107',
      customer_id: 'cust-1',
      date: '2026-03-12',
      number: '5011',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 12, price: 102.00 },
        { product_id: 'prod-3', qty: 6, price: 114.00 },
        { product_id: 'prod-5', qty: 25, price: 19.00 }
      ],
      shipping: 90.00
    },
    // April
    {
      id: 'ord-108',
      customer_id: 'cust-2',
      date: '2026-04-02',
      number: '5080',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 60, price: 101.00 },
        { product_id: 'prod-2', qty: 40, price: 142.00 },
        { product_id: 'prod-3', qty: 20, price: 120.00 } // oil spiking!
      ],
      discount: 300.00,
      shipping: 300.00
    },
    {
      id: 'ord-109',
      customer_id: 'cust-4',
      date: '2026-04-10',
      number: '12604',
      type: 'pdf',
      items: [
        { product_id: 'prod-1', qty: 8, price: 108.00 },
        { product_id: 'prod-3', qty: 5, price: 125.00 },
        { product_id: 'prod-7', qty: 12, price: 24.50 }
      ],
      shipping: 60.00
    },
    {
      id: 'ord-110',
      customer_id: 'cust-3',
      date: '2026-04-20',
      number: '5190',
      type: 'xml',
      items: [
        { product_id: 'prod-4', qty: 80, price: 11.00 },
        { product_id: 'prod-5', qty: 10, price: 20.00 }
      ],
      shipping: 80.00
    },
    // May
    {
      id: 'ord-111',
      customer_id: 'cust-1',
      date: '2026-05-10',
      number: '5240',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 15, price: 108.00 },
        { product_id: 'prod-2', qty: 8, price: 148.00 },
        { product_id: 'prod-3', qty: 8, price: 132.00 } // oil increased significantly
      ],
      shipping: 100.00
    },
    {
      id: 'ord-112',
      customer_id: 'cust-3',
      date: '2026-05-18',
      number: '5295',
      type: 'xml',
      items: [
        { product_id: 'prod-4', qty: 120, price: 10.50 }, // volume discount
        { product_id: 'prod-5', qty: 15, price: 21.00 }
      ],
      shipping: 80.00
    },
    {
      id: 'ord-113',
      customer_id: 'cust-1',
      date: '2026-05-20',
      number: '5310',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 15, price: 110.00 },
        { product_id: 'prod-5', qty: 30, price: 21.50 }
      ],
      shipping: 90.00
    },
    {
      id: 'ord-114',
      customer_id: 'cust-2',
      date: '2026-05-25',
      number: '5350',
      type: 'xml',
      items: [
        { product_id: 'prod-1', qty: 80, price: 106.00 },
        { product_id: 'prod-2', qty: 50, price: 150.00 },
        { product_id: 'prod-3', qty: 25, price: 136.00 } // oil record
      ],
      discount: 400.00,
      shipping: 350.00
    }
  ];

  // Process mock invoices to fill tables
  mockInvoices.forEach((inv) => {
    // 1. Calculate totals
    let itemsSum = 0;
    inv.items.forEach(it => { itemsSum += (it.qty * it.price); });
    const disc = inv.discount || 0;
    const sh = inv.shipping || 0;
    const finalAmount = itemsSum - disc + sh;

    // 2. Add Order
    const order: Order = {
      id: inv.id,
      customer_id: inv.customer_id,
      invoice_key: inv.type === 'xml' ? `352605${inv.number}12480001895500100000${inv.number}827163012` : null,
      invoice_number: inv.number,
      order_number: `PED-${inv.number}`,
      issue_date: inv.date,
      source_file_type: inv.type,
      source_file_name: `nota_fiscal_${inv.number}.${inv.type}`,
      total_amount: finalAmount,
      discount_amount: inv.discount || null,
      shipping_amount: inv.shipping || null,
      status: 'completed',
      created_at: `${inv.date}T10:00:00Z`,
      updated_at: `${inv.date}T10:00:00Z`
    };
    orders.push(order);

    // 3. Add Items & Price History
    inv.items.forEach((it, idx) => {
      const itemId = `item-${inv.id}-${idx}`;
      const prod = products.find(p => p.id === it.product_id)!;

      const orderItem: OrderItem = {
        id: itemId,
        order_id: inv.id,
        product_id: it.product_id,
        product_code: prod.code,
        description: prod.name,
        quantity: it.qty,
        unit: prod.unit,
        unit_price: it.price,
        total_price: it.qty * it.price,
        discount: null,
        created_at: `${inv.date}T10:00:00Z`
      };
      orderItems.push(orderItem);

      const ph: PriceHistory = {
        id: `ph-${inv.id}-${idx}`,
        product_id: it.product_id,
        customer_id: inv.customer_id,
        order_id: inv.id,
        order_item_id: itemId,
        date: inv.date,
        unit_price: it.price,
        quantity: it.qty,
        total_price: it.qty * it.price,
        source: inv.type,
        created_at: `${inv.date}T10:00:00Z`
      };
      priceHistory.push(ph);
    });

    // 4. Create dummy upload
    uploads.push({
      id: `upl-${inv.id}`,
      file_name: `nota_fiscal_${inv.number}.${inv.type}`,
      file_type: inv.type,
      file_url: null,
      status: 'completed',
      error_message: null,
      extracted_data: null,
      created_at: `${inv.date}T09:30:00Z`
    });
  });

  // Save everything to storage
  saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
  saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  saveToStorage(STORAGE_KEYS.ORDERS, orders);
  saveToStorage(STORAGE_KEYS.ORDER_ITEMS, orderItems);
  saveToStorage(STORAGE_KEYS.PRICE_HISTORY, priceHistory);
  saveToStorage(STORAGE_KEYS.UPLOADS, uploads);
  saveToStorage(STORAGE_KEYS.USER_ROLE, 'admin');
}

// Call check and initialize immediately
checkAndInitializeMockData();

// --- DATABASE FUNCTIONS ---

export const db = {
  // Configs
  getUserRole(): UserRole {
    return loadFromStorage<UserRole>(STORAGE_KEYS.USER_ROLE, 'admin');
  },

  setUserRole(role: UserRole): void {
    saveToStorage(STORAGE_KEYS.USER_ROLE, role);
  },

  // Customers
  getCustomers(): Customer[] {
    return loadFromStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  },

  getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find(c => c.id === id);
  },

  saveCustomer(customer: Customer): void {
    const list = this.getCustomers();
    const idx = list.findIndex(c => c.id === customer.id);
    if (idx >= 0) {
      list[idx] = { ...customer, updated_at: new Date().toISOString() };
    } else {
      list.push(customer);
    }
    saveToStorage(STORAGE_KEYS.CUSTOMERS, list);
  },

  deleteCustomer(id: string): boolean {
    // Check if customer has orders
    const orders = this.getOrders().filter(o => o.customer_id === id);
    if (orders.length > 0) return false; // Cannot delete

    const list = this.getCustomers();
    const filtered = list.filter(c => c.id !== id);
    saveToStorage(STORAGE_KEYS.CUSTOMERS, filtered);
    return true;
  },

  // Products
  getProducts(): Product[] {
    return loadFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
  },

  getProductById(id: string): Product | undefined {
    return this.getProducts().find(p => p.id === id);
  },

  saveProduct(product: Product): void {
    const list = this.getProducts();
    const idx = list.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      list[idx] = { ...product, updated_at: new Date().toISOString() };
    } else {
      list.push(product);
    }
    saveToStorage(STORAGE_KEYS.PRODUCTS, list);
  },

  deleteProduct(id: string): boolean {
    const items = this.getOrderItems().filter(i => i.product_id === id);
    if (items.length > 0) return false; // Has items vinculated

    const list = this.getProducts();
    const filtered = list.filter(p => p.id !== id);
    saveToStorage(STORAGE_KEYS.PRODUCTS, filtered);
    return true;
  },

  // Orders
  getOrders(): Order[] {
    return loadFromStorage<Order[]>(STORAGE_KEYS.ORDERS, []);
  },

  getOrderById(id: string): Order | undefined {
    return this.getOrders().find(o => o.id === id);
  },

  saveOrder(order: Order): void {
    const list = this.getOrders();
    const idx = list.findIndex(o => o.id === order.id);
    if (idx >= 0) {
      list[idx] = { ...order, updated_at: new Date().toISOString() };
    } else {
      list.push(order);
    }
    saveToStorage(STORAGE_KEYS.ORDERS, list);
  },

  deleteOrder(id: string): void {
    // 1. Remove order items
    const allItems = this.getOrderItems();
    const filteredItems = allItems.filter(item => item.order_id !== id);
    saveToStorage(STORAGE_KEYS.ORDER_ITEMS, filteredItems);

    // 2. Remove price histories
    const allPh = this.getPriceHistory();
    const filteredPh = allPh.filter(ph => ph.order_id !== id);
    saveToStorage(STORAGE_KEYS.PRICE_HISTORY, filteredPh);

    // 3. Remove order
    const allOrders = this.getOrders();
    const filteredOrders = allOrders.filter(o => o.id !== id);
    saveToStorage(STORAGE_KEYS.ORDERS, filteredOrders);

    // 4. Recalculate all statistics for customers and products
    this.recalculateAllStats();
  },

  // Order Items
  getOrderItems(): OrderItem[] {
    return loadFromStorage<OrderItem[]>(STORAGE_KEYS.ORDER_ITEMS, []);
  },

  getOrderItemsByOrder(orderId: string): OrderItem[] {
    return this.getOrderItems().filter(i => i.order_id === orderId);
  },

  // Price History
  getPriceHistory(): PriceHistory[] {
    return loadFromStorage<PriceHistory[]>(STORAGE_KEYS.PRICE_HISTORY, []);
  },

  getPriceHistoryByProduct(productId: string): PriceHistory[] {
    return this.getPriceHistory()
      .filter(ph => ph.product_id === productId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  getPriceHistoryByProductAndCustomer(productId: string, customerId: string): PriceHistory[] {
    return this.getPriceHistory()
      .filter(ph => ph.product_id === productId && ph.customer_id === customerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  // Uploads
  getUploads(): Upload[] {
    return loadFromStorage<Upload[]>(STORAGE_KEYS.UPLOADS, []);
  },

  saveUpload(upload: Upload): void {
    const list = this.getUploads();
    const idx = list.findIndex(u => u.id === upload.id);
    if (idx >= 0) {
      list[idx] = upload;
    } else {
      list.push(upload);
    }
    saveToStorage(STORAGE_KEYS.UPLOADS, list);
  },

  // Big Import Function
  importInvoice(invoice: NormalizedInvoice): Order {
    const customers = this.getCustomers();
    const products = this.getProducts();
    const orders = this.getOrders();
    const orderItems = this.getOrderItems();
    const priceHistories = this.getPriceHistory();

    const timestamp = new Date().toISOString();
    const issueDate = invoice.issue_date || timestamp.split('T')[0];

    // 1. Upsert Customer
    let customer = customers.find(c => 
      (invoice.customer_document && c.document === invoice.customer_document) || 
      c.name.toLowerCase() === invoice.customer_name.toLowerCase()
    );

    if (!customer) {
      customer = {
        id: `cust-${Math.random().toString(36).substring(2, 9)}`,
        name: invoice.customer_name,
        document: invoice.customer_document,
        email: null,
        phone: null,
        city: invoice.customer_city || null,
        state: invoice.customer_state || null,
        notes: 'Criado automaticamente na importação.',
        first_purchase_date: issueDate,
        last_purchase_date: issueDate,
        total_orders: 0,
        total_amount: 0,
        created_at: timestamp,
        updated_at: timestamp
      };
      customers.push(customer);
    }

    // 2. Create Order
    const orderId = invoice.id || `ord-${Math.random().toString(36).substring(2, 9)}`;
    const newOrder: Order = {
      id: orderId,
      customer_id: customer.id,
      invoice_key: invoice.invoice_key,
      invoice_number: invoice.invoice_number,
      order_number: invoice.order_number || `PED-${invoice.invoice_number || Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      issue_date: issueDate,
      source_file_type: invoice.source_file_type,
      source_file_name: invoice.source_file_name,
      total_amount: invoice.total_amount,
      discount_amount: invoice.discount_amount,
      shipping_amount: invoice.shipping_amount,
      status: 'completed',
      created_at: timestamp,
      updated_at: timestamp
    };
    orders.push(newOrder);

    // 3. Process Items & Link/Create Products
    invoice.items.forEach((item, index) => {
      // Find matching product
      // A. Try by EAN/barcode
      // B. Try by product code
      // C. Try by exact name
      // D. Try by normalized description similarity
      const itemNormName = getNormalizedDescription(item.description);
      let product = products.find(p => 
        (item.barcode && p.barcode === item.barcode) ||
        (item.product_code && p.code === item.product_code) ||
        p.normalized_name === itemNormName
      );

      // If still not found, try containing substring as suggestion
      if (!product) {
        product = products.find(p => p.normalized_name.includes(itemNormName) || itemNormName.includes(p.normalized_name));
      }

      if (!product) {
        // Create new product
        product = {
          id: `prod-${Math.random().toString(36).substring(2, 9)}`,
          code: item.product_code,
          barcode: item.barcode,
          name: item.description,
          normalized_name: itemNormName,
          category: 'Não Categorizado',
          brand: null,
          unit: item.unit,
          ncm: item.ncm,
          notes: 'Criado automaticamente na importação.',
          first_seen_at: issueDate,
          last_seen_at: issueDate,
          created_at: timestamp,
          updated_at: timestamp
        };
        products.push(product);
      }

      // Add OrderItem
      const orderItemId = `item-${orderId}-${index}`;
      const newOrderItem: OrderItem = {
        id: orderItemId,
        order_id: orderId,
        product_id: product.id,
        product_code: product.code,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        discount: item.discount,
        created_at: timestamp
      };
      orderItems.push(newOrderItem);

      // Add Price History
      const ph: PriceHistory = {
        id: `ph-${orderId}-${index}`,
        product_id: product.id,
        customer_id: customer!.id,
        order_id: orderId,
        order_item_id: orderItemId,
        date: issueDate,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total_price: item.total_price,
        source: invoice.source_file_type,
        created_at: timestamp
      };
      priceHistories.push(ph);
    });

    // Save lists
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
    saveToStorage(STORAGE_KEYS.PRODUCTS, products);
    saveToStorage(STORAGE_KEYS.ORDERS, orders);
    saveToStorage(STORAGE_KEYS.ORDER_ITEMS, orderItems);
    saveToStorage(STORAGE_KEYS.PRICE_HISTORY, priceHistories);

    // 4. Recalculate statistics
    this.recalculateAllStats();

    return newOrder;
  },

  // Recalculate statistics for all customers and products
  recalculateAllStats(): void {
    const customers = loadFromStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const products = loadFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const orders = loadFromStorage<Order[]>(STORAGE_KEYS.ORDERS, []);
    const priceHistories = loadFromStorage<PriceHistory[]>(STORAGE_KEYS.PRICE_HISTORY, []);


    // 1. Recalculate Customer stats
    customers.forEach(cust => {
      const custOrders = orders.filter(o => o.customer_id === cust.id);
      if (custOrders.length === 0) {
        cust.total_orders = 0;
        cust.total_amount = 0;
        cust.first_purchase_date = null;
        cust.last_purchase_date = null;
        return;
      }

      cust.total_orders = custOrders.length;
      cust.total_amount = custOrders.reduce((sum, o) => sum + o.total_amount, 0);

      // Dates sorting
      const dates = custOrders
        .map(o => o.issue_date)
        .filter(d => !!d)
        .sort() as string[];
      
      cust.first_purchase_date = dates[0] || null;
      cust.last_purchase_date = dates[dates.length - 1] || null;
      cust.updated_at = new Date().toISOString();
    });

    // 2. Recalculate Product stats
    products.forEach(prod => {
      const prodHistory = priceHistories.filter(ph => ph.product_id === prod.id);
      if (prodHistory.length === 0) {
        prod.first_seen_at = null;
        prod.last_seen_at = null;
        return;
      }

      const dates = prodHistory
        .map(ph => ph.date)
        .filter(d => !!d)
        .sort() as string[];

      prod.first_seen_at = dates[0] || null;
      prod.last_seen_at = dates[dates.length - 1] || null;
      prod.updated_at = new Date().toISOString();
    });

    // Save
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
    saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  },

  // Reset database (wipes and reinstalls mock data)
  resetDatabase(): void {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.ORDER_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.PRICE_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.UPLOADS);
    checkAndInitializeMockData();
  }
};
