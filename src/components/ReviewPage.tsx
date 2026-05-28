import { useState, useEffect } from 'react';
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

interface ReviewPageProps {
  invoice: NormalizedInvoice;
  onSave: (finalInvoice: NormalizedInvoice) => void;
  onCancel: () => void;
}

export function ReviewPage({ invoice, onSave, onCancel }: ReviewPageProps) {
  // State for editable customer info
  const [customerName, setCustomerName] = useState(invoice.customer_name);
  const [customerDocument, setCustomerDocument] = useState(invoice.customer_document || '');
  const [customerCity, setCustomerCity] = useState(invoice.customer_city || '');
  const [customerState, setCustomerState] = useState(invoice.customer_state || '');

  // State for editable order info
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number || '');
  const [orderNumber, setOrderNumber] = useState(invoice.order_number || '');
  const [issueDate, setIssueDate] = useState(invoice.issue_date || '');
  const [discountAmount, setDiscountAmount] = useState<number>(invoice.discount_amount || 0);
  const [shippingAmount, setShippingAmount] = useState<number>(invoice.shipping_amount || 0);

  // State for editable items
  const [items, setItems] = useState<any[]>(invoice.items);

  // Available products list for linking
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  useEffect(() => {
    setAvailableProducts(db.getProducts());
  }, []);

  // Update item field
  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [field]: value };
      
      // Auto recalculate total if commercial quantity or price changes
      if (field === 'commercial_quantity' || field === 'commercial_unit_price') {
        const q = field === 'commercial_quantity' ? parseFloat(value) || 0 : item.commercial_quantity;
        const p = field === 'commercial_unit_price' ? parseFloat(value) || 0 : item.commercial_unit_price;
        updated.commercial_total_price = Math.round((q * p) * 100) / 100;
        
        // Also recalculate internal logic
        const upp = item.units_per_package || 1;
        updated.internal_quantity = Math.round((q * upp) * 100) / 100;
        updated.internal_unit_price = Math.round((updated.commercial_unit_price / upp) * 100) / 100;
      }

      // If units_per_package changes
      if (field === 'units_per_package') {
        const upp = value || 1;
        updated.internal_quantity = Math.round((item.commercial_quantity * upp) * 100) / 100;
        updated.internal_unit_price = Math.round((item.commercial_unit_price / upp) * 100) / 100;
      }
      
      return updated;
    }));
  };

  // Auto-correct all totals
  const handleAutoCorrectTotals = () => {
    setItems(prev => prev.map(item => {
      const correctTotal = Math.round((item.commercial_quantity * item.commercial_unit_price) * 100) / 100;
      return {
        ...item,
        commercial_total_price: correctTotal
      };
    }));
  };

  // Link item to an existing product
  const handleLinkProduct = (index: number, productId: string) => {
    const prod = availableProducts.find(p => p.id === productId);
    if (!prod) return;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        product_code: prod.code,
        barcode: prod.barcode,
        description: prod.name,
        normalized_description: prod.normalized_name,
        commercial_unit: prod.default_commercial_unit || item.commercial_unit,
        internal_unit: prod.default_internal_unit || item.internal_unit
      };
    }));
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Add item manually
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
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
        discount: null
      }
    ]);
  };

  // Calculate items sum
  const itemsTotal = items.reduce((sum, item) => sum + (item.commercial_total_price || 0), 0);
  const totalValue = Math.max(0, itemsTotal - discountAmount + shippingAmount);

  // Form submit handler
  const handleSaveClick = () => {
    if (!customerName.trim()) {
      alert("Por favor, preencha o nome do cliente.");
      return;
    }
    if (items.length === 0) {
      alert("O pedido deve conter pelo menos um item.");
      return;
    }

    // New validations
    const hasZeroQuantity = items.some(item => (parseFloat(item.commercial_quantity) || 0) <= 0);
    if (hasZeroQuantity) {
      alert("Não é permitido salvar pedido com quantidade comercial zero.");
      return;
    }

    const hasZeroPrice = items.some(item => (parseFloat(item.commercial_unit_price) || 0) <= 0);
    if (hasZeroPrice) {
      alert("Não é permitido salvar pedido com preço comercial zero.");
      return;
    }

    const pkgUnits = ['CX', 'CXA', 'CAIXA', 'FD', 'FARDO', 'PCT', 'PACOTE', 'PACK', 'EMB', 'DISPLAY', 'DZ', 'DUZIA', 'KIT'];
    const hasInvalidPkg = items.some(item => {
      const u = item.commercial_unit?.toUpperCase() || '';
      const isPkg = pkgUnits.includes(u);
      const upp = parseInt(item.units_per_package) || 0;
      return isPkg && upp < 1;
    });
    if (hasInvalidPkg) {
      alert("Há itens com unidade de embalagem (CX, FD, PCT, etc) sem 'Unidades por embalagem' (mínimo 1).");
      return;
    }

    // Check existing order with same key
    if (invoice.invoice_key) {
      const existingOrder = db.getOrders().find(o => o.invoice_key === invoice.invoice_key);
      if (existingOrder) {
        if (!window.confirm("Esta nota (mesma chave de acesso) já foi importada. Deseja importar novamente e duplicar?")) {
          return;
        }
      }
    }

    // Check for units_per_package overwrites for linked products
    for (const item of items) {
      if (!item.product_code) continue;
      const existingProduct = db.getProducts().find(p => p.code === item.product_code || p.normalized_name === item.normalized_description);
      if (existingProduct && existingProduct.units_per_package && existingProduct.units_per_package > 1) {
        const itemUpp = parseInt(item.units_per_package) || 1;
        if (existingProduct.units_per_package !== itemUpp) {
          if (!window.confirm(`O produto "${item.description}" está cadastrado com ${existingProduct.units_per_package} unidades por embalagem. A revisão atual indica ${itemUpp}. Deseja alterar para ${itemUpp}?`)) {
            return;
          }
        }
      }
    }

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
      total_amount: Math.round(totalValue * 100) / 100,
      items: items.map(item => ({
        ...item,
        commercial_quantity: parseFloat(item.commercial_quantity) || 0,
        commercial_unit_price: parseFloat(item.commercial_unit_price) || 0,
        commercial_total_price: parseFloat(item.commercial_total_price) || 0,
        units_per_package: parseInt(item.units_per_package) || 1,
      })),
      status: 'completed'
    };

    onSave(finalInvoice);
  };

  const getOriginDetails = () => {
    switch (invoice.source_file_type) {
      case 'xml': return { label: 'XML', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      default: return { label: 'Manual', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
    }
  };
  const origin = getOriginDetails();

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 glass-panel rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-bold font-outfit text-white tracking-wide">Revise os dados do pedido antes de salvar</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-slate-400">Arquivo:</span>
            <code className="text-slate-300 font-mono text-xs bg-slate-900 px-2 py-1 rounded">{invoice.source_file_name}</code>
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${origin.color}`}>
              {origin.label}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Client and Invoice General Data */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Customer Section */}
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

          {/* Invoice Headers Section */}
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
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Frete (R$)</label>
                  <input
                    type="number"
                    value={shippingAmount || ''}
                    onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              {/* Total Card */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850 mt-4 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Soma dos Itens:</span>
                  <span>R$ {itemsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Desconto / Frete:</span>
                  <span>-R$ {discountAmount.toFixed(2)} / +R$ {shippingAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 mt-1">
                  <span className="text-xs font-bold text-slate-200">Valor Total do Pedido:</span>
                  <span className="text-sm font-bold text-white font-outfit">R$ {totalValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Items Grid Table */}
        <div className="lg:col-span-3 space-y-4">
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
                  title="Corrigir o total de todos os itens baseando-se em Quantidade * Preço Unitário"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Corrigir automaticamente totais</span>
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

            {/* Items list table */}
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-[9px] uppercase font-bold bg-slate-900/30">
                    <th className="py-2 px-2" colSpan={2}>Produto / Vínculo</th>
                    <th className="py-2 px-2 text-center border-l border-slate-800/50" colSpan={4}>Visão Comercial (XML)</th>
                    <th className="py-2 px-2 text-center border-l border-slate-800/50 bg-brand-900/10" colSpan={4}>Visão Interna (Unidade)</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                  <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/50">
                    <th className="py-2.5 pr-2 w-48">Códigos</th>
                    <th className="py-2.5 pr-2">Descrição / XML</th>
                    
                    <th className="py-2.5 px-2 text-center w-14 border-l border-slate-800/50">Un. XML</th>
                    <th className="py-2.5 px-2 text-center w-14">Qtd XML</th>
                    <th className="py-2.5 px-2 text-right w-20">Preço Emb.</th>
                    <th className="py-2.5 px-2 text-right w-24">Total XML</th>

                    <th className="py-2.5 px-2 text-center w-16 border-l border-slate-800/50 bg-brand-900/10">Un/Emb</th>
                    <th className="py-2.5 px-2 text-center w-16 bg-brand-900/10">Qtd Int.</th>
                    <th className="py-2.5 px-2 text-center w-14 bg-brand-900/10">Un. Int.</th>
                    <th className="py-2.5 px-2 text-right w-20 bg-brand-900/10">Preço Un.</th>
                    <th className="py-2.5 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {items.map((item, idx) => {
                    // Try to find if this item matches any registered product
                    const matchedProd = availableProducts.find(p => 
                      p.code === item.product_code || 
                      p.normalized_name === item.normalized_description
                    );

                    // Math validation per row
                    const expectedTotal = item.commercial_quantity * item.commercial_unit_price;
                    const isRowInconsistent = Math.abs(expectedTotal - item.commercial_total_price) > 0.05;

                    return (
                      <tr 
                        key={idx} 
                        className={`group transition-colors ${
                          isRowInconsistent 
                            ? 'bg-rose-500/5 hover:bg-rose-500/10' 
                            : 'hover:bg-slate-900/10'
                        }`}
                      >
                        {/* Link product / Code / NCM / CFOP inputs */}
                        <td className="py-3 pr-2">
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={item.product_code || ''}
                              onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                              placeholder="Código"
                              className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white focus:outline-none ${
                                isRowInconsistent ? 'border-rose-500/20' : 'border-slate-800'
                              }`}
                            />
                            
                            <div className="grid grid-cols-2 gap-1">
                              <input
                                type="text"
                                value={item.ncm || ''}
                                onChange={(e) => handleItemChange(idx, 'ncm', e.target.value)}
                                placeholder="NCM"
                                className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-1.5 py-0.5 text-[9px] text-white focus:outline-none ${
                                  isRowInconsistent ? 'border-rose-500/20' : 'border-slate-800'
                                }`}
                              />
                              <input
                                type="text"
                                value={item.cfop || ''}
                                onChange={(e) => handleItemChange(idx, 'cfop', e.target.value)}
                                placeholder="CFOP"
                                className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-1.5 py-0.5 text-[9px] text-white focus:outline-none ${
                                  isRowInconsistent ? 'border-rose-500/20' : 'border-slate-800'
                                }`}
                              />
                            </div>

                            <select
                              onChange={(e) => handleLinkProduct(idx, e.target.value)}
                              value={matchedProd ? matchedProd.id : ''}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-slate-400 focus:outline-none mt-1"
                            >
                              <option value="">{matchedProd ? '✓ Vinculado' : '⚡ Criar novo produto'}</option>
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code || 'S/C'})</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="py-3 pr-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white focus:outline-none font-medium ${
                              isRowInconsistent ? 'border-rose-500/25' : 'border-slate-800'
                            }`}
                          />
                          <span className="text-[8px] text-slate-500 mt-0.5 block truncate max-w-[200px]">
                            Norm: {item.normalized_description || 'n/a'}
                          </span>
                        </td>

                        {/* Commercial Vision */}
                        {/* Unit / Emb */}
                        <td className="py-3 px-2 text-center border-l border-slate-800/50">
                          <input
                            type="text"
                            value={item.commercial_unit || ''}
                            maxLength={3}
                            onChange={(e) => handleItemChange(idx, 'commercial_unit', e.target.value.toUpperCase())}
                            className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-1.5 py-1 text-[10px] text-white text-center focus:outline-none ${
                              isRowInconsistent ? 'border-rose-500/25' : 'border-slate-800'
                            }`}
                          />
                        </td>

                        {/* Qtd */}
                        <td className="py-3 px-2 text-center">
                          <input
                            type="number"
                            step="any"
                            value={item.commercial_quantity || ''}
                            onChange={(e) => handleItemChange(idx, 'commercial_quantity', e.target.value)}
                            className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-1.5 py-1 text-[10px] text-white text-center focus:outline-none ${
                              isRowInconsistent ? 'border-rose-500/40 text-rose-300 font-semibold' : 'border-slate-800'
                            }`}
                          />
                        </td>

                        {/* Unit Price (Caixa) */}
                        <td className="py-3 px-2 text-right">
                          <input
                            type="number"
                            step="any"
                            value={item.commercial_unit_price || ''}
                            onChange={(e) => handleItemChange(idx, 'commercial_unit_price', e.target.value)}
                            className={`w-full bg-slate-950 border focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white text-right focus:outline-none ${
                              isRowInconsistent ? 'border-rose-500/40 text-rose-300 font-semibold' : 'border-slate-800'
                            }`}
                          />
                        </td>

                        {/* Total Price */}
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isRowInconsistent && (
                              <span title={`Qtd * Unitário = R$ ${expectedTotal.toFixed(2)} (Diferença de R$ ${Math.abs(expectedTotal - item.commercial_total_price).toFixed(2)})`}>
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              </span>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              value={item.commercial_total_price || ''}
                              onChange={(e) => handleItemChange(idx, 'commercial_total_price', e.target.value)}
                              className={`w-20 bg-slate-950 border focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white text-right focus:outline-none font-semibold ${
                                isRowInconsistent ? 'border-rose-500 text-rose-400 font-bold' : 'border-slate-800 text-slate-300'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Internal Vision */}
                        {/* Un/Emb */}
                        <td className="py-3 px-2 text-center border-l border-slate-800/50 bg-brand-900/5">
                          <input
                            type="number"
                            step="1"
                            value={item.units_per_package || ''}
                            placeholder="1"
                            onChange={(e) => handleItemChange(idx, 'units_per_package', parseInt(e.target.value) || '')}
                            className="w-full bg-slate-950 border border-brand-500/50 focus:border-brand-400 rounded px-1 py-1 text-[10px] text-brand-300 text-center font-bold focus:outline-none shadow-inner shadow-brand-500/10"
                          />
                        </td>

                        {/* Qtd Int. */}
                        <td className="py-3 px-2 text-center bg-brand-900/5">
                          <div className="w-full bg-slate-950/50 border border-slate-800/50 rounded px-2 py-1 text-[10px] text-emerald-400/80 text-center font-mono">
                            {item.internal_quantity || 0}
                          </div>
                        </td>

                        {/* Un. Int. */}
                        <td className="py-3 px-2 text-center bg-brand-900/5">
                          <input
                            type="text"
                            value={item.internal_unit || 'UN'}
                            maxLength={3}
                            onChange={(e) => handleItemChange(idx, 'internal_unit', e.target.value.toUpperCase())}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded px-1.5 py-1 text-[10px] text-white text-center focus:outline-none"
                          />
                        </td>

                        {/* Preço Un. (Calculado) */}
                        <td className="py-3 px-2 text-right bg-brand-900/5">
                          <div className="w-full bg-slate-950/80 border border-emerald-500/30 rounded px-2 py-1 text-[11px] text-emerald-400 text-right font-bold shadow-sm shadow-emerald-500/10">
                            R$ {item.internal_unit_price ? item.internal_unit_price.toFixed(2) : item.commercial_unit_price.toFixed(2)}
                          </div>
                        </td>

                        {/* Delete button */}
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>


      {/* Save / Cancel buttons */}
      <div className="flex justify-end items-center gap-3 border-t border-slate-800/80 pt-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-xl transition-all"
        >
          Cancelar Importação
        </button>
        <button
          onClick={handleSaveClick}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/10 transition-all hover:translate-y-[-1px]"
        >
          <Check className="w-4 h-4" />
          <span>Salvar Pedido na Base</span>
        </button>
      </div>

    </div>
  );
}
