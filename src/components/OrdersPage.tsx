import { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Trash2, 
  Eye, 
  ArrowLeft,
  User,
  Activity,
  Code
} from 'lucide-react';
import { db } from '../services/db';
import type { Order } from '../services/db';
import { formatCurrency, formatQuantity, formatSignedCurrency } from '../services/formatters';
import { matchesSearch } from '../services/search';


interface OrdersPageProps {
  userRole: string;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
}

export function OrdersPage({ userRole, selectedOrderId, setSelectedOrderId }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, xml
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [showRaw, setShowRaw] = useState(false);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadOrdersList();
  }, [selectedOrderId]);

  const loadOrdersList = () => {
    setOrders(db.getOrders().sort((a, b) => new Date(b.issue_date || '').getTime() - new Date(a.issue_date || '').getTime()));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert("Apenas administradores podem excluir pedidos da base.");
      return;
    }
    if (confirm("Deseja realmente excluir este pedido? Isso removerá o faturamento dos relatórios e recalculada as médias dos produtos/clientes.")) {
      db.deleteOrder(id);
      alert("Pedido removido com sucesso.");
      if (selectedOrderId === id) setSelectedOrderId(null);
      loadOrdersList();
    }
  };

  // Get customer options for dropdown
  const customersList = db.getCustomers();

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const cust = db.getCustomerById(o.customer_id);
    const items = db.getOrderItemsByOrder(o.id);
    const itemSearchValues = items.flatMap(item => {
      const product = item.product_id ? db.getProductById(item.product_id) : undefined;
      return [
        item.description,
        item.product_code,
        item.barcode,
        item.ncm,
        item.cfop,
        item.commercial_unit,
        item.internal_unit,
        product?.name,
        product?.code,
        product?.barcode,
        product?.ncm
      ];
    });
    
    const matchesOrderSearch = matchesSearch(search, [
      cust?.name,
      cust?.document,
      cust?.city,
      cust?.state,
      o.invoice_number,
      o.invoice_series,
      o.order_number,
      o.invoice_key,
      o.source_file_name,
      o.issue_date,
      o.total_amount,
      ...itemSearchValues
    ]);

    const matchesType = filterType === 'all' || o.source_file_type === filterType;
    const matchesCustomer = filterCustomer === 'all' || o.customer_id === filterCustomer;

    return matchesOrderSearch && matchesType && matchesCustomer;
  });

  // Render detail view if selected
  if (selectedOrderId) {
    const order = db.getOrderById(selectedOrderId);
    if (!order) {
      return (
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Pedido não encontrado.</p>
          <button onClick={() => setSelectedOrderId(null)} className="text-brand-400 font-semibold hover:underline mt-2">
            Voltar para a lista
          </button>
        </div>
      );
    }

    const customer = db.getCustomerById(order.customer_id);
    const items = db.getOrderItemsByOrder(order.id);
    
    const itemsSum = items.reduce((sum, item) => sum + item.commercial_total_price, 0);

    return (
      <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto">
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setSelectedOrderId(null)}
              className="p-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-outfit text-white tracking-wide break-words">Faturamento: {order.order_number}</h2>
              <span className="text-xs text-slate-500 font-mono break-all">ID Registro: {order.id} • Processado em {new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isAdmin && (
              <button
                onClick={(e) => handleDelete(order.id, e)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Pedido</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          
          {/* Left Column: Metadata cards */}
          <div className="space-y-5 xl:col-span-1">
            
            {/* Customer Spec */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="w-4 h-4 text-brand-500" />
                Cliente Vinculado
              </h3>
              {customer ? (
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="font-semibold text-slate-200">{customer.name}</div>
                  <div className="font-mono text-slate-400">{customer.document || 'S/D'}</div>
                  <div className="text-slate-400">{customer.city ? `${customer.city} - ${customer.state || ''}` : 'Cidade não cadastrada'}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">Cliente removido ou não vinculado.</div>
              )}
            </div>

            {/* Document details */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-accent-cyan" />
                Informações da Nota
              </h3>
              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chave Nota (XML):</span>
                  <span className="font-mono text-[9px] text-right truncate max-w-[150px]" title={order.invoice_key || ''}>
                    {order.invoice_key || 'Não disponível'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Número da Nota:</span>
                  <span className="font-mono text-slate-200">{order.invoice_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data Emissão:</span>
                  <span className="font-mono">{order.issue_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Origem:</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                    order.source_file_type === 'xml' 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}>
                    {order.source_file_type.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nome do Arquivo:</span>
                  <span className="font-mono text-[9px] truncate max-w-[130px]" title={order.source_file_name}>
                    {order.source_file_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="glass-panel rounded-2xl p-5 space-y-3 bg-slate-900/30">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
                Resumo Valores
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Soma Itens:</span>
                  <span>{formatCurrency(itemsSum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Desconto:</span>
                  <span className="text-rose-400">{formatCurrency(-(order.discount_amount || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Frete:</span>
                  <span className="text-emerald-400">{formatSignedCurrency(order.shipping_amount || 0)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-2 font-bold text-sm">
                  <span className="text-slate-200">Faturamento Final:</span>
                  <span className="text-white font-outfit">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Items and Raw toggle */}
          <div className="xl:col-span-2 space-y-5 min-w-0">
            
            {/* Items details table */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-accent-emerald" />
                Itens Faturados
              </h3>
              <div className="overflow-x-auto border border-slate-800/40 rounded-xl">
                <table className="w-full min-w-[900px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-[9px] uppercase font-bold bg-slate-900/30">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3 text-center border-l border-slate-800/50">Qtd XML</th>
                      <th className="py-2.5 px-3 text-center">Un XML</th>
                      <th className="py-2.5 px-3 text-right">R$ Emb</th>
                      <th className="py-2.5 px-3 text-center border-l border-brand-900/20 bg-brand-900/10 text-brand-400">Qtd Int.</th>
                      <th className="py-2.5 px-3 text-center bg-brand-900/10 text-brand-400">Un Int.</th>
                      <th className="py-2.5 px-3 text-right bg-brand-900/10 text-brand-400">R$ Un</th>
                      <th className="py-2.5 px-3 text-right">Total XML</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/20">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/10">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{item.product_code || 'S/C'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-200">{item.description}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300 font-mono border-l border-slate-800/50">{formatQuantity(item.commercial_quantity)}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{item.commercial_unit || 'UN'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{formatCurrency(item.commercial_unit_price)}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-400/80 font-mono border-l border-brand-900/20 bg-brand-900/5">{formatQuantity(item.internal_quantity)}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-500 font-bold bg-brand-900/5">{item.internal_unit || 'UN'}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 bg-brand-900/5">{formatCurrency(item.internal_unit_price || item.commercial_unit_price)}</td>
                        <td className="py-2.5 px-3 text-right font-outfit text-white font-bold">{formatCurrency(item.commercial_total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Raw Toggle */}
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <button 
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider hover:text-brand-400 transition-colors focus:outline-none"
              >
                <Code className="w-4 h-4 text-brand-500" />
                <span>Auditoria de Logs do Arquivo {showRaw ? '[-]' : '[+]'}</span>
              </button>

              {showRaw && (
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 text-[10px] font-mono text-slate-400 max-h-72 overflow-y-auto overflow-x-auto whitespace-pre no-scrollbar leading-relaxed">
                  <div>
                    <div className="text-slate-500 border-b border-slate-800 pb-1.5 mb-2 font-semibold">XML estruturado recuperado da NF-e:</div>
                    {db.getUploads().find(u => u.file_name === order.source_file_name)?.extracted_data?.raw_xml || `Chave XML: ${order.invoice_key}\nNenhum log bruto salvo no storage local.`}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Render List View
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Faturamento & Pedidos</h2>
          <p className="text-sm text-slate-400 mt-1">Monitore faturamentos importados, filtre por tipo de nota e audite os registros originais.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, produto, código, nota ou chave..."
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Source File Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full md:w-40 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none transition-colors"
        >
          <option value="all">Formato Nota (Todos)</option>
          <option value="xml">Apenas XML</option>
        </select>

        {/* Customer Filter */}
        <select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className="w-full md:w-56 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none transition-colors"
        >
          <option value="all">Clientes (Todos)</option>
          {customersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Orders List Grid Table */}
      <div className="md:hidden space-y-3">
        {filteredOrders.map((order) => {
          const cust = db.getCustomerById(order.customer_id);
          const isXml = order.source_file_type === 'xml';
          return (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className="w-full text-left glass-panel rounded-2xl p-4 border border-slate-800/70 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white font-outfit break-words">{order.order_number}</div>
                  <div className="text-[11px] text-slate-500 font-mono">Nota: {order.invoice_number || 'S/N'}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                  isXml ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                }`}>
                  {order.source_file_type.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 break-words">{cust?.name || 'Cliente Desconhecido'}</div>
                <div className="text-[11px] text-slate-500 font-mono break-all">{cust?.document || 'S/D'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Emissão</div>
                  <div className="text-slate-300 font-mono">{order.issue_date || 'S/D'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total</div>
                  <div className="text-white font-bold">{formatCurrency(order.total_amount)}</div>
                </div>
              </div>
            </button>
          );
        })}
        {filteredOrders.length === 0 && (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-xs">
            Nenhum pedido importado ainda. Comece enviando seu primeiro XML.
          </div>
        )}
      </div>

      <div className="hidden md:block glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30">
                <th className="py-3 px-4">Pedido / Nota</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4 text-center">Origem</th>
                <th className="py-3 px-4 text-center">Data Emissão</th>
                <th className="py-3 px-4 text-right">Desconto / Frete</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredOrders.map((order) => {
                const cust = db.getCustomerById(order.customer_id);
                const isXml = order.source_file_type === 'xml';
                return (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrderId(order.id)}
                    className="hover:bg-slate-900/20 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono">
                      <div className="font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">{order.order_number}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Nota: {order.invoice_number || 'S/N'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-300 truncate max-w-[260px]" title={cust?.name || 'Cliente Desconhecido'}>{cust?.name || 'Cliente Desconhecido'}</div>
                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">{cust?.document || 'S/D'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                        isXml ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {order.source_file_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">
                      {order.issue_date}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 font-mono">
                      {formatCurrency(-(order.discount_amount || 0))} / {formatSignedCurrency(order.shipping_amount || 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-outfit text-white font-bold">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(order.id, e)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 animate-fade-in"
                            title="Excluir pedido"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Eye className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 text-xs">
                    Nenhum pedido importado ainda. Comece enviando seu primeiro XML.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
