import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  User,
  FileText,
  Package
} from 'lucide-react';
import { db } from '../services/db';
import type { NormalizedInvoice, Product } from '../services/db';
import {
  calculateInternalQuantity,
  calculateInternalUnitPrice,
  detectBaseUnit,
  detectPackagingUnit,
  getNormalizedDescription,
  PACKAGING_REVIEW_WARNING,
  roundAmount
} from '../services/normalizer';
import { formatCurrency, formatSignedCurrency } from '../services/formatters';
import { findBestMatchingProduct } from '../services/productMatcher';

interface ReviewPageProps {
  invoice: NormalizedInvoice;
  onSave: (finalInvoice: NormalizedInvoice) => void;
  onCancel: () => void;
  reviewQueueCount?: number;
}

type ReviewItem = NormalizedInvoice['items'][number];
type ReviewValidationIssue = {
  key: string;
  itemIndex?: number;
  message: string;
  severity: 'error' | 'warning';
};

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeReviewItem(item: ReviewItem): ReviewItem {
  const commercialUnit = (item.commercial_unit || 'UN').toUpperCase().trim();
  const isPackaging = detectPackagingUnit(commercialUnit);
  const rawUnits = isPackaging ? toNumber(item.units_per_package) : 1;
  const unitsPerPackage = isPackaging ? rawUnits : 1;
  const safeUnits = unitsPerPackage > 0 ? unitsPerPackage : 1;
  const commercialQuantity = toNumber(item.commercial_quantity) > 0
    ? toNumber(item.commercial_quantity)
    : toNumber(item.qTrib);
  const commercialUnitPrice = toNumber(item.commercial_unit_price) > 0
    ? toNumber(item.commercial_unit_price)
    : toNumber(item.vUnTrib);
  const rawCommercialTotal = toNumber(item.commercial_total_price);
  const commercialTotalPrice = rawCommercialTotal > 0
    ? rawCommercialTotal
    : roundAmount(commercialQuantity * commercialUnitPrice);
  const packagingRequiresReview = isPackaging && unitsPerPackage <= 1;

  return {
    ...item,
    commercial_unit: commercialUnit,
    commercial_quantity: commercialQuantity,
    commercial_unit_price: commercialUnitPrice,
    commercial_total_price: roundAmount(commercialTotalPrice),
    units_per_package: unitsPerPackage,
    internal_unit: item.internal_unit || detectBaseUnit(commercialUnit),
    internal_quantity: calculateInternalQuantity(commercialQuantity, safeUnits),
    internal_unit_price: calculateInternalUnitPrice(commercialUnitPrice, safeUnits),
    packaging_requires_review: packagingRequiresReview,
    packaging_warning: packagingRequiresReview ? PACKAGING_REVIEW_WARNING : null,
    save_conversion_to_product: isPackaging ? item.save_conversion_to_product ?? true : item.save_conversion_to_product ?? false
  };
}

function getItemLabel(item: ReviewItem, index: number): string {
  return `Item ${index + 1}${item.description ? ` - ${item.description}` : ''}`;
}

export function ReviewPage({ invoice, onSave, onCancel, reviewQueueCount = 0 }: ReviewPageProps) {
  const [customerName, setCustomerName] = useState(invoice.customer_name);
  const [customerDocument, setCustomerDocument] = useState(invoice.customer_document || '');
  const [customerCity, setCustomerCity] = useState(invoice.customer_city || '');
  const [customerState, setCustomerState] = useState(invoice.customer_state || '');

  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number || '');
  const [orderNumber, setOrderNumber] = useState(invoice.order_number || '');
  const [issueDate, setIssueDate] = useState(invoice.issue_date || '');
  const [discountAmount, setDiscountAmount] = useState<number>(invoice.discount_amount || 0);
  const [shippingAmount, setShippingAmount] = useState<number>(invoice.shipping_amount || 0);

  const [items, setItems] = useState<ReviewItem[]>(() => invoice.items.map(normalizeReviewItem));
  const [availableProducts] = useState<Product[]>(() => db.getProducts());

  const findProductForItem = (item: ReviewItem): Product | undefined => {
    if (item.product_id) {
      const byId = availableProducts.find(product => product.id === item.product_id);
      if (byId) return byId;
    }
    return findBestMatchingProduct(availableProducts, {
      product_code: item.product_code,
      barcode: item.barcode,
      description: item.description,
      normalized_description: item.normalized_description
    });
  };

  const invalidPackageItems = useMemo(
    () => items.filter(item => detectPackagingUnit(item.commercial_unit) && toNumber(item.units_per_package) <= 1),
    [items]
  );

  const validationIssues = useMemo(() => {
    const issues: ReviewValidationIssue[] = [];

    if (!customerName.trim()) {
      issues.push({
        key: 'customer',
        message: 'Cliente vazio',
        severity: 'error'
      });
    }

    if (items.length === 0) {
      issues.push({
        key: 'items-empty',
        message: 'A nota precisa ter pelo menos um item',
        severity: 'error'
      });
    }

    items.forEach((item, index) => {
      const itemLabel = getItemLabel(item, index);
      const expectedTotal = roundAmount(toNumber(item.commercial_quantity) * toNumber(item.commercial_unit_price));
      const totalDifference = Math.abs(expectedTotal - toNumber(item.commercial_total_price));

      if (toNumber(item.commercial_quantity) <= 0) {
        issues.push({
          key: `quantity-${index}`,
          itemIndex: index,
          message: `${itemLabel}: quantidade comercial precisa ser maior que zero`,
          severity: 'error'
        });
      }
      if (toNumber(item.commercial_unit_price) <= 0) {
        issues.push({
          key: `unit-price-${index}`,
          itemIndex: index,
          message: `${itemLabel}: preço comercial precisa ser maior que zero`,
          severity: 'error'
        });
      }
      if (toNumber(item.commercial_total_price) <= 0) {
        issues.push({
          key: `total-${index}`,
          itemIndex: index,
          message: `${itemLabel}: total comercial precisa ser maior que zero`,
          severity: 'error'
        });
      }
      if (detectPackagingUnit(item.commercial_unit) && toNumber(item.units_per_package) <= 1) {
        issues.push({
          key: `package-${index}`,
          itemIndex: index,
          message: `${itemLabel}: informe quantas unidades existem dentro da embalagem`,
          severity: 'error'
        });
      }
      if (totalDifference > 0.05) {
        issues.push({
          key: `total-warning-${index}`,
          itemIndex: index,
          message: `${itemLabel}: total comercial difere de quantidade x preço`,
          severity: 'warning'
        });
      }
    });

    return issues;
  }, [customerName, items]);

  const blockingIssues = validationIssues.filter(issue => issue.severity === 'error');
  const hasBlockingRows = blockingIssues.length > 0;

  const handleItemChange = (index: number, field: keyof ReviewItem, value: ReviewItem[keyof ReviewItem]) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const updated: ReviewItem = { ...item, [field]: value };

      if (field === 'description') {
        updated.normalized_description = getNormalizedDescription(String(value || ''));
      }

      if (field === 'commercial_unit') {
        const commercialUnit = String(value || 'UN').toUpperCase().trim();
        updated.commercial_unit = commercialUnit;
        updated.internal_unit = detectBaseUnit(commercialUnit);
        if (detectPackagingUnit(commercialUnit)) {
          updated.save_conversion_to_product = true;
        } else {
          updated.units_per_package = 1;
          updated.save_conversion_to_product = false;
        }
      }

      if (field === 'commercial_quantity' || field === 'commercial_unit_price') {
        const quantity = field === 'commercial_quantity' ? toNumber(value) : toNumber(item.commercial_quantity);
        const unitPrice = field === 'commercial_unit_price' ? toNumber(value) : toNumber(item.commercial_unit_price);
        updated.commercial_total_price = roundAmount(quantity * unitPrice);
      }

      return normalizeReviewItem(updated);
    }));
  };

  const handleAutoCorrectTotals = () => {
    setItems(prev => prev.map(item => normalizeReviewItem({
      ...item,
      commercial_total_price: roundAmount(toNumber(item.commercial_quantity) * toNumber(item.commercial_unit_price))
    })));
  };

  const handleLinkProduct = (index: number, productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (!product) return;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const commercialUnit = product.default_commercial_unit || item.commercial_unit || 'UN';
      const unitsPerPackage = product.units_per_package && product.units_per_package > 0
        ? product.units_per_package
        : item.units_per_package;

      return normalizeReviewItem({
        ...item,
        product_id: product.id,
        product_code: product.code,
        barcode: product.barcode,
        description: product.name,
        normalized_description: product.normalized_name,
        commercial_unit: commercialUnit,
        internal_unit: product.default_internal_unit || detectBaseUnit(commercialUnit),
        units_per_package: unitsPerPackage,
        conversion_source: 'product',
        matched_product_name: product.name,
        save_conversion_to_product: detectPackagingUnit(commercialUnit) ? true : item.save_conversion_to_product
      });
    }));
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      normalizeReviewItem({
        product_id: null,
        product_code: '',
        barcode: '',
        description: 'Novo Item Manual',
        normalized_description: 'novo item manual',
        ncm: '',
        cfop: '',
        commercial_quantity: 1,
        commercial_unit: 'UN',
        commercial_unit_price: 0,
        commercial_total_price: 0,
        units_per_package: 1,
        internal_unit: 'UN',
        internal_quantity: 1,
        internal_unit_price: 0,
        packaging_requires_review: false,
        packaging_warning: null,
        save_conversion_to_product: false,
        discount: null
      })
    ]);
  };

  const itemsTotal = items.reduce((sum, item) => sum + toNumber(item.commercial_total_price), 0);
  const totalValue = Math.max(0, itemsTotal - discountAmount + shippingAmount);

  const handleSaveClick = () => {
    if (blockingIssues.length > 0) {
      const visibleIssues = blockingIssues.slice(0, 6).map(issue => `- ${issue.message}`).join('\n');
      const suffix = blockingIssues.length > 6 ? `\n- mais ${blockingIssues.length - 6} pendência(s)` : '';
      alert(`Corrija as pendências antes de salvar:\n${visibleIssues}${suffix}`);
      return;
    }

    if (invoice.invoice_key) {
      const existingOrder = db.getOrders().find(o => o.invoice_key === invoice.invoice_key);
      if (existingOrder && !window.confirm('Esta nota (mesma chave de acesso) já foi importada. Deseja importar novamente e duplicar?')) {
        return;
      }
    }

    const deniedConversionUpdates = new Set<number>();
    items.forEach((item, idx) => {
      const product = findProductForItem(item);
      const itemUnits = toNumber(item.units_per_package);
      if (
        product?.units_per_package &&
        product.units_per_package > 1 &&
        itemUnits > 1 &&
        product.units_per_package !== itemUnits &&
        item.save_conversion_to_product
      ) {
        const confirmed = window.confirm(
          `O produto "${item.description}" está cadastrado com ${product.units_per_package} unidades por embalagem. Deseja atualizar o cadastro para ${itemUnits}?`
        );
        if (!confirmed) deniedConversionUpdates.add(idx);
      }
    });

    const finalItems = items.map((item, idx) => {
      const normalized = normalizeReviewItem(item);
      return {
        ...normalized,
        commercial_quantity: toNumber(normalized.commercial_quantity),
        commercial_unit_price: toNumber(normalized.commercial_unit_price),
        commercial_total_price: toNumber(normalized.commercial_total_price),
        units_per_package: toNumber(normalized.units_per_package),
        internal_quantity: toNumber(normalized.internal_quantity),
        internal_unit_price: toNumber(normalized.internal_unit_price),
        save_conversion_to_product: Boolean(normalized.save_conversion_to_product) && !deniedConversionUpdates.has(idx)
      };
    });

    const finalInvoice: NormalizedInvoice = {
      ...invoice,
      customer_name: customerName,
      customer_document: customerDocument || null,
      customer_city: customerCity || null,
      customer_state: customerState || null,
      invoice_number: invoiceNumber || null,
      order_number: orderNumber || null,
      issue_date: issueDate || null,
      discount_amount: discountAmount > 0 ? discountAmount : null,
      shipping_amount: shippingAmount > 0 ? shippingAmount : null,
      total_amount: roundAmount(totalValue),
      items: finalItems,
      status: 'completed'
    };

    onSave(finalInvoice);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24 max-w-[1680px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 glass-panel rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-bold font-outfit text-white tracking-wide">Revise os dados do pedido antes de salvar</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-slate-400">Arquivo:</span>
            <code className="text-slate-300 font-mono text-xs bg-slate-900 px-2 py-1 rounded">{invoice.source_file_name}</code>
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
              XML
            </span>
          </div>
          {invoice.invoice_key && (
            <div className="mt-2 text-[10px] flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-semibold uppercase">Chave de Acesso:</span>
              <span className="font-mono text-emerald-400 tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                {invoice.invoice_key.match(/.{1,4}/g)?.join(' ') || invoice.invoice_key}
              </span>
            </div>
          )}
          {reviewQueueCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-cyan-200 bg-cyan-500/10 border border-cyan-500/25 rounded-xl px-3 py-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Fila de XMLs: ao salvar esta nota, o próximo arquivo abre automaticamente ({reviewQueueCount} restante(s)).</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[320px_minmax(0,1fr)] gap-5">
        <div className="space-y-5">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <User className="w-4 h-4 text-brand-500" />
              Dados do Cliente
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Nome / Razão Social</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">CPF / CNPJ</label>
                <input
                  type="text"
                  value={customerDocument}
                  onChange={(e) => setCustomerDocument(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Cidade</label>
                  <input
                    type="text"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">UF</label>
                  <input
                    type="text"
                    value={customerState}
                    maxLength={2}
                    onChange={(e) => setCustomerState(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white text-center focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <FileText className="w-4 h-4 text-accent-cyan" />
              Dados do Pedido / Nota
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Número Nota</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Número Pedido</label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Data Emissão</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Desconto (R$)</label>
                  <input
                    type="number"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(toNumber(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Frete (R$)</label>
                  <input
                    type="number"
                    value={shippingAmount || ''}
                    onChange={(e) => setShippingAmount(toNumber(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850 mt-4 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Soma dos Itens:</span>
                  <span>{formatCurrency(itemsTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Desconto / Frete:</span>
                  <span>{formatCurrency(-discountAmount)} / {formatSignedCurrency(shippingAmount)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 mt-1">
                  <span className="text-xs font-bold text-slate-200">Valor Total do Pedido:</span>
                  <span className="text-sm font-bold text-white font-outfit">{formatCurrency(totalValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-accent-emerald" />
                Itens da Nota / Produtos ({items.length})
              </h3>

              <div className="flex items-center self-end sm:self-auto">
                <button
                  onClick={handleAutoCorrectTotals}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold transition-colors mr-2"
                  title="Corrigir o total de todos os itens com quantidade x preço unitário"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Corrigir totais</span>
                </button>
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Item</span>
                </button>
              </div>
            </div>

            {invalidPackageItems.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-2 rounded-xl text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{PACKAGING_REVIEW_WARNING} antes de salvar.</span>
              </div>
            )}

            {validationIssues.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Pendências da revisão
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {validationIssues.slice(0, 8).map(issue => (
                    <button
                      key={issue.key}
                      onClick={() => {
                        if (issue.itemIndex !== undefined) {
                          document.getElementById(`review-item-${issue.itemIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className={`text-left text-[11px] leading-relaxed rounded-lg border px-3 py-2 ${
                        issue.severity === 'error'
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                      }`}
                    >
                      {issue.message}
                    </button>
                  ))}
                </div>
                {validationIssues.length > 8 && (
                  <div className="text-[10px] text-slate-500">
                    Mais {validationIssues.length - 8} pendência(s) nesta nota.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, idx) => {
                const matchedProd = findProductForItem(item);
                const expectedTotal = toNumber(item.commercial_quantity) * toNumber(item.commercial_unit_price);
                const isRowInconsistent = Math.abs(expectedTotal - toNumber(item.commercial_total_price)) > 0.05;
                const isPackaging = detectPackagingUnit(item.commercial_unit);
                const needsConversion = Boolean(item.packaging_requires_review);

                return (
                  <div
                    key={idx}
                    id={`review-item-${idx}`}
                    className={`rounded-xl border p-4 ${
                      needsConversion
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : isRowInconsistent
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-slate-800/80 bg-slate-950/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Item {idx + 1}</div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="mt-1 w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-semibold"
                        />
                        {item.packaging_warning && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {item.packaging_warning}
                          </div>
                        )}
                        {item.conversion_source === 'product' && (
                          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2 py-1">
                            <Check className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              Conversão aplicada do cadastro{item.matched_product_name ? `: ${item.matched_product_name}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-900 transition-colors"
                        title="Remover item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.4fr)] gap-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Código</span>
                            <input
                              type="text"
                              value={item.product_code || ''}
                              onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">NCM</span>
                            <input
                              type="text"
                              value={item.ncm || ''}
                              onChange={(e) => handleItemChange(idx, 'ncm', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">CFOP</span>
                            <input
                              type="text"
                              value={item.cfop || ''}
                              onChange={(e) => handleItemChange(idx, 'cfop', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Vínculo</span>
                            <select
                              onChange={(e) => handleLinkProduct(idx, e.target.value)}
                              value={matchedProd ? matchedProd.id : ''}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                            >
                              <option value="">{matchedProd ? 'Vinculado' : 'Criar novo'}</option>
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code || 'S/C'})</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className={`flex items-start gap-2 text-xs ${isPackaging ? 'text-amber-200' : 'text-slate-600'}`}>
                          <input
                            type="checkbox"
                            checked={Boolean(item.save_conversion_to_product)}
                            disabled={!isPackaging}
                            onChange={(e) => handleItemChange(idx, 'save_conversion_to_product', e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-amber-500"
                          />
                          <span>Salvar essa conversão no cadastro do produto</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3 space-y-3">
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Comercial da nota</div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Un. com.</span>
                              <input
                                type="text"
                                value={item.commercial_unit || ''}
                                maxLength={7}
                                onChange={(e) => handleItemChange(idx, 'commercial_unit', e.target.value.toUpperCase())}
                                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white text-center font-bold focus:outline-none ${
                                  needsConversion ? 'border-amber-500 text-amber-200' : 'border-slate-800 focus:border-brand-500'
                                }`}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Qtd. com.</span>
                              <input
                                type="number"
                                step="any"
                                value={item.commercial_quantity || ''}
                                onChange={(e) => handleItemChange(idx, 'commercial_quantity', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none"
                              />
                            </label>
                            <label className="space-y-1 col-span-2">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                                {isPackaging ? 'Preço embalagem' : 'Preço unit. com.'}
                              </span>
                              <input
                                type="number"
                                step="any"
                                value={item.commercial_unit_price || ''}
                                onChange={(e) => handleItemChange(idx, 'commercial_unit_price', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none"
                              />
                            </label>
                            <label className="space-y-1 col-span-2">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Total comercial</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.commercial_total_price || ''}
                                onChange={(e) => handleItemChange(idx, 'commercial_total_price', e.target.value)}
                                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white text-right font-bold focus:outline-none ${
                                  isRowInconsistent ? 'border-rose-500 text-rose-300' : 'border-slate-800 focus:border-brand-500'
                                }`}
                              />
                            </label>
                          </div>
                          {isRowInconsistent && (
                            <div className="text-[10px] text-rose-300 font-semibold">
                              Quantidade x preço = {formatCurrency(expectedTotal)}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-3">
                          <div className="text-[10px] text-amber-300 uppercase font-bold tracking-wide">Conversão da embalagem</div>
                          <label className="space-y-1 block">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Un./emb.</span>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={toNumber(item.units_per_package) > 0 ? item.units_per_package : ''}
                              placeholder="Ex: 24"
                              onChange={(e) => handleItemChange(idx, 'units_per_package', e.target.value)}
                              className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-base text-center font-bold focus:outline-none ${
                                needsConversion
                                  ? 'border-amber-400 text-amber-200 bg-amber-950/20'
                                  : 'border-amber-500/40 text-amber-200 focus:border-amber-400'
                              }`}
                            />
                          </label>
                          <div className="text-[11px] text-slate-400 leading-relaxed">
                            Qtd. interna = qtd. comercial x unidades por embalagem.
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-3">
                          <div className="text-[10px] text-emerald-300 uppercase font-bold tracking-wide">Resultado interno</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Qtd. int.</span>
                              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-emerald-300 text-right font-bold">
                                {toNumber(item.internal_quantity)}
                              </div>
                            </div>
                            <label className="space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Un. int.</span>
                              <input
                                type="text"
                                value={item.internal_unit || 'UN'}
                                maxLength={7}
                                onChange={(e) => handleItemChange(idx, 'internal_unit', e.target.value.toUpperCase())}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg px-3 py-2 text-sm text-white text-center font-bold focus:outline-none"
                              />
                            </label>
                            <div className="space-y-1 col-span-2">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Preço interno</span>
                              <div className="w-full bg-slate-950/80 border border-emerald-500/40 rounded-lg px-3 py-2 text-base text-emerald-300 text-right font-bold">
                                {formatCurrency(toNumber(item.internal_unit_price))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3 shadow-2xl shadow-slate-950/60">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">
              Total da nota: {formatCurrency(totalValue)}
            </div>
            <div className={`mt-1 text-[11px] ${hasBlockingRows ? 'text-amber-300' : 'text-slate-400'}`}>
              {hasBlockingRows
                ? `${blockingIssues.length} pendência(s) bloqueando o salvamento. Clique nas pendências acima para ir ao item.`
                : reviewQueueCount > 0
                  ? `Tudo certo nesta nota. Depois de salvar, ${reviewQueueCount === 1 ? 'mais 1 XML será aberto' : `mais ${reviewQueueCount} XMLs serão abertos`} para revisão.`
                  : 'Tudo certo para salvar esta nota na base.'}
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 shrink-0">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveClick}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-xs font-semibold shadow-lg transition-all hover:translate-y-[-1px] ${
                hasBlockingRows
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/10'
                  : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/10'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{reviewQueueCount > 0 ? 'Salvar e abrir próximo XML' : 'Salvar Nota na Base'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
