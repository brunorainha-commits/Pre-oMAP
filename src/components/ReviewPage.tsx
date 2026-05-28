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
      
      // Auto recalculate total if quantity or price changes
      if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
        const p = field === 'unit_price' ? parseFloat(value) || 0 : item.unit_price;
        updated.total_price = Math.round((q * p) * 100) / 100;
      }
      
      return updated;
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
        unit: prod.unit || item.unit
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
        quantity: 1,
        unit: 'UN',
        unit_price: 0,
        total_price: 0,
        discount: null
      }
    ]);
  };

  // Calculate items sum
  const itemsTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
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

    const finalInvoice: NormalizedInvoice = {
      ...invoice,
      customer_name: customerName,
      customer_document: customerDocument || null,
      customer_city: customerCity || undefined,
      customer_state: customerState || undefined,
      invoice_number: invoiceNumber || null,
      order_number: orderNumber || null,
      issue_date: issueDate || null,
      discount_amount: discountAmount > 0 ? discountAmount : null,
      shipping_amount: shippingAmount > 0 ? shippingAmount : null,
      total_amount: Math.round(totalValue * 100) / 100,
      items: items.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0
      })),
      status: 'completed'
    };

    onSave(finalInvoice);
  };

  const isPdf = invoice.source_file_type === 'pdf';
  const confidencePercent = Math.round((invoice.confidence_score || 0.5) * 100);

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-6xl mx-auto">
      
      {/* Top Banner Warning for PDF */}
      {isPdf && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs leading-normal">
            <strong className="font-semibold block text-amber-300">Conferência Recomendada (PDF)</strong>
            Os dados extraídos de arquivos PDF podem conter imprecisões. Por favor, confira o cliente, produtos, quantidades e preços unitários antes de confirmar o salvamento na base comercial.
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Revise os dados do pedido antes de salvar</h2>
          <p className="text-sm text-slate-400 mt-1">Valide e altere os campos abaixo mapeados a partir do arquivo <code className="text-slate-300 font-mono text-xs">{invoice.source_file_name}</code>.</p>
        </div>

        {/* Confidence badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Nível de Confiança</span>
            <span className={`text-xs font-bold ${
              confidencePercent > 80 ? 'text-emerald-400' : confidencePercent > 40 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {confidencePercent}% de precisão
            </span>
          </div>
          <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs" style={{
            borderColor: confidencePercent > 80 ? '#10b981' : confidencePercent > 40 ? '#f59e0b' : '#f43f5e',
            color: confidencePercent > 80 ? '#10b981' : confidencePercent > 40 ? '#f59e0b' : '#f43f5e'
          }}>
            {confidencePercent}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
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
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-accent-emerald" />
                Itens da Nota / Produtos ({items.length})
              </h3>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Item</span>
              </button>
            </div>

            {/* Items list table */}
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold">
                    <th className="py-2.5 pr-2">Link Produto existente / Cód.</th>
                    <th className="py-2.5 pr-2">Descrição Normalizada</th>
                    <th className="py-2.5 pr-2 text-center w-12">Qtd</th>
                    <th className="py-2.5 pr-2 text-center w-12">Un</th>
                    <th className="py-2.5 pr-2 text-right w-20">Unitário (R$)</th>
                    <th className="py-2.5 pr-2 text-right w-24">Total (R$)</th>
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

                    return (
                      <tr key={idx} className="group hover:bg-slate-900/10">
                        {/* Link product selection or code */}
                        <td className="py-3 pr-2">
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={item.product_code || ''}
                              onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                              placeholder="Código"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                            />
                            <select
                              onChange={(e) => handleLinkProduct(idx, e.target.value)}
                              value={matchedProd ? matchedProd.id : ''}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-slate-400 focus:outline-none"
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
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white focus:outline-none font-medium"
                          />
                          <span className="text-[8px] text-slate-500 mt-0.5 block truncate max-w-[150px]">
                            Norm: {item.normalized_description || 'n/a'}
                          </span>
                        </td>

                        {/* Qtd */}
                        <td className="py-3 pr-2 text-center">
                          <input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded px-1.5 py-1 text-[10px] text-white text-center focus:outline-none"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-3 pr-2 text-center">
                          <input
                            type="text"
                            value={item.unit || ''}
                            maxLength={3}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value.toUpperCase())}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded px-1.5 py-1 text-[10px] text-white text-center focus:outline-none"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-3 pr-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price || ''}
                            onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded px-2 py-1 text-[10px] text-white text-right focus:outline-none"
                          />
                        </td>

                        {/* Total Price */}
                        <td className="py-3 pr-2 text-right font-outfit font-semibold text-slate-300">
                          R$ {item.total_price?.toFixed(2)}
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
