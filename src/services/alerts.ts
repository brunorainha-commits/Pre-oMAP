// Alerts Service (alerts.ts)

import { db } from './db';
import { formatCurrency } from './formatters';


export interface CommercialAlert {
  id: string;
  type: 'price_increase' | 'price_decrease' | 'customer_inactive' | 'product_inactive' | 'new_product' | 'new_customer' | 'duplicate_customer' | 'duplicate_product' | 'anomalous_order';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  target_id: string; // ID of product, customer, order, etc.
  meta?: any; // Additional data like percentage change, dates
  created_at: string;
}

const DISMISSED_ALERTS_KEY = 'precomap_dismissed_alert_ids';

function readDismissedAlertIds(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissedAlertIds(ids: string[]): void {
  localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function dismissAlert(alertId: string): void {
  writeDismissedAlertIds([...readDismissedAlertIds(), alertId]);
}

export function dismissAlerts(alertIds: string[]): void {
  writeDismissedAlertIds([...readDismissedAlertIds(), ...alertIds]);
}

export function isActionableAlert(alert: CommercialAlert): boolean {
  return alert.severity === 'high';
}

export function getActionableAlerts(alerts: CommercialAlert[]): CommercialAlert[] {
  return alerts.filter(isActionableAlert);
}

export function generateAlerts(): CommercialAlert[] {
  const alerts: CommercialAlert[] = [];
  const customers = db.getCustomers();
  const products = db.getProducts();
  const orders = db.getOrders().sort((a, b) => new Date(b.issue_date || '').getTime() - new Date(a.issue_date || '').getTime());
  const priceHistory = db.getPriceHistory();

  const currentDate = new Date('2026-05-28'); // Set current date as per mock time

  // 1. Inactive Customers (30, 60, 90 days)
  customers.forEach(cust => {
    if (!cust.last_purchase_date) return;
    const lastDate = new Date(cust.last_purchase_date);
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 90) {
      alerts.push({
        id: `alert-inactive-90-${cust.id}`,
        type: 'customer_inactive',
        severity: 'high',
        title: 'Cliente inativo há mais de 90 dias',
        description: `O cliente "${cust.name}" não compra desde ${cust.last_purchase_date} (há ${diffDays} dias).`,
        target_id: cust.id,
        meta: { days: diffDays, lastDate: cust.last_purchase_date },
        created_at: new Date().toISOString()
      });
    } else if (diffDays >= 60) {
      alerts.push({
        id: `alert-inactive-60-${cust.id}`,
        type: 'customer_inactive',
        severity: 'medium',
        title: 'Cliente inativo há mais de 60 dias',
        description: `O cliente "${cust.name}" não realiza compras desde ${cust.last_purchase_date} (há ${diffDays} dias).`,
        target_id: cust.id,
        meta: { days: diffDays, lastDate: cust.last_purchase_date },
        created_at: new Date().toISOString()
      });
    } else if (diffDays >= 30) {
      alerts.push({
        id: `alert-inactive-30-${cust.id}`,
        type: 'customer_inactive',
        severity: 'low',
        title: 'Cliente sem compras recente (30+ dias)',
        description: `O cliente "${cust.name}" fez sua última compra em ${cust.last_purchase_date} (há ${diffDays} dias).`,
        target_id: cust.id,
        meta: { days: diffDays, lastDate: cust.last_purchase_date },
        created_at: new Date().toISOString()
      });
    }
  });

  // 2. Price Variations
  // For each product, analyze price history changes
  products.forEach(prod => {
    const history = priceHistory
      .filter(ph => ph.product_id === prod.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (history.length < 2) return;

    // Get the latest two purchases of this product (across all clients or per client)
    // Let's check general price variation first
    const latestPh = history[history.length - 1];
    const previousPh = history[history.length - 2];

    const currentPrice = latestPh.internal_unit_price;
    const prevPrice = previousPh.internal_unit_price;
    
    if (prevPrice > 0) {
      const varPct = ((currentPrice - prevPrice) / prevPrice) * 100;
      
      if (varPct >= 10) {
        alerts.push({
          id: `alert-price-up-${latestPh.order_id}-${prod.id}`,
          type: 'price_increase',
          severity: 'high',
          title: `Aumento expressivo no preço: +${varPct.toFixed(1)}%`,
          description: `O produto "${prod.name}" aumentou de ${formatCurrency(prevPrice)} para ${formatCurrency(currentPrice)} na última nota.`,
          target_id: prod.id,
          meta: { varPct, oldPrice: prevPrice, newPrice: currentPrice, date: latestPh.date },
          created_at: new Date().toISOString()
        });
      } else if (varPct <= -10) {
        alerts.push({
          id: `alert-price-down-${latestPh.order_id}-${prod.id}`,
          type: 'price_decrease',
          severity: 'medium',
          title: `Queda expressiva no preço: ${varPct.toFixed(1)}%`,
          description: `O produto "${prod.name}" caiu de ${formatCurrency(prevPrice)} para ${formatCurrency(currentPrice)} na última nota.`,
          target_id: prod.id,
          meta: { varPct, oldPrice: prevPrice, newPrice: currentPrice, date: latestPh.date },
          created_at: new Date().toISOString()
        });
      }
    }
  });

  // 3. New Customer Detected (within 7 days of currentDate)
  customers.forEach(cust => {
    const createdDate = new Date(cust.created_at);
    const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      alerts.push({
        id: `alert-new-cust-${cust.id}`,
        type: 'new_customer',
        severity: 'low',
        title: 'Novo cliente cadastrado',
        description: `O cliente "${cust.name}" foi adicionado automaticamente a partir de notas fiscais recentes.`,
        target_id: cust.id,
        created_at: cust.created_at
      });
    }
  });

  // 4. New Product Detected
  products.forEach(prod => {
    const createdDate = new Date(prod.created_at);
    const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      alerts.push({
        id: `alert-new-prod-${prod.id}`,
        type: 'new_product',
        severity: 'low',
        title: 'Novo produto detectado',
        description: `O produto "${prod.name}" (Código: ${prod.code || 'S/C'}) foi catalogado pela primeira vez.`,
        target_id: prod.id,
        created_at: prod.created_at
      });
    }
  });

  // 5. Possible Duplicity - Customer Name/CNPJ similarity
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const c1 = customers[i];
      const c2 = customers[j];
      
      // Duplicity check: Same document
      if (c1.document && c2.document && c1.document === c2.document) {
        alerts.push({
          id: `alert-dup-cust-doc-${c1.id}-${c2.id}`,
          type: 'duplicate_customer',
          severity: 'high',
          title: 'Possível duplicidade de cliente (Documento)',
          description: `Os clientes "${c1.name}" e "${c2.name}" compartilham o mesmo documento (${c1.document}).`,
          target_id: c1.id,
          meta: { match_id: c2.id },
          created_at: new Date().toISOString()
        });
      }
      // Duplicity check: Name similarity
      const name1 = c1.name.toLowerCase();
      const name2 = c2.name.toLowerCase();
      if (name1.includes(name2) || name2.includes(name1)) {
        alerts.push({
          id: `alert-dup-cust-name-${c1.id}-${c2.id}`,
          type: 'duplicate_customer',
          severity: 'medium',
          title: 'Possível duplicidade de cliente (Nome)',
          description: `Os nomes de "${c1.name}" e "${c2.name}" são altamente semelhantes.`,
          target_id: c1.id,
          meta: { match_id: c2.id },
          created_at: new Date().toISOString()
        });
      }
    }
  }

  // 6. Possible Duplicity - Product similarity
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const p1 = products[i];
      const p2 = products[j];

      // Same code or barcode
      if ((p1.code && p2.code && p1.code === p2.code) || (p1.barcode && p2.barcode && p1.barcode === p2.barcode)) {
        alerts.push({
          id: `alert-dup-prod-code-${p1.id}-${p2.id}`,
          type: 'duplicate_product',
          severity: 'high',
          title: 'Possível duplicidade de produto (Código/EAN)',
          description: `Os produtos "${p1.name}" e "${p2.name}" compartilham o mesmo código (${p1.code || p1.barcode}).`,
          target_id: p1.id,
          meta: { match_id: p2.id },
          created_at: new Date().toISOString()
        });
      }
    }
  }

  // 7. Anomalous Order values
  orders.forEach(order => {
    const cust = customers.find(c => c.id === order.customer_id);
    if (!cust) return;

    // Calculate customer average order amount excluding this order
    const otherOrders = orders.filter(o => o.customer_id === cust.id && o.id !== order.id);
    if (otherOrders.length < 3) return; // Need a baseline of at least 3 other orders

    const avgAmount = otherOrders.reduce((sum, o) => sum + o.total_amount, 0) / otherOrders.length;
    
    if (order.total_amount > avgAmount * 2.0) {
      alerts.push({
        id: `alert-anom-high-${order.id}`,
        type: 'anomalous_order',
        severity: 'medium',
        title: 'Pedido com valor acima do padrão',
        description: `O pedido ${order.order_number} de ${formatCurrency(order.total_amount)} é mais do que o dobro da média habitual deste cliente (${formatCurrency(avgAmount)}).`,
        target_id: order.id,
        meta: { avgAmount, currentAmount: order.total_amount },
        created_at: order.created_at
      });
    }
  });

  const dismissedAlertIds = new Set(readDismissedAlertIds());

  return alerts.filter(alert => !dismissedAlertIds.has(alert.id)).sort((a, b) => {
    const severityWeight = { high: 3, medium: 2, low: 1 };
    return severityWeight[b.severity] - severityWeight[a.severity];
  });
}
