import { useState, useEffect } from 'react';
import { 
  Tag, 
  Users, 
  Percent, 
  Activity, 
  AlertTriangle 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/db';
import type { Product, Customer } from '../services/db';
import { formatCurrency, formatSignedCurrency } from '../services/formatters';

export function PriceHistoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Selection states
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [filterVariance, setFilterVariance] = useState<'all' | 'up' | 'down'>('all');

  useEffect(() => {
    setProducts(db.getProducts());
    setCustomers(db.getCustomers());
    
    // Auto select first product if available
    const allProds = db.getProducts();
    if (allProds.length > 0) {
      setSelectedProductId(allProds[0].id);
    }
  }, []);

  const activeProduct = products.find(p => p.id === selectedProductId);

  // Get price histories
  const priceHistories = db.getPriceHistory();

  // Filter histories based on product and customer
  const filteredHistories = priceHistories
    .filter(ph => {
      const matchProd = ph.product_id === selectedProductId;
      const matchCust = selectedCustomerId === 'all' || ph.customer_id === selectedCustomerId;
      return matchProd && matchCust;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Generate client table list comparing last purchases
  // For the selected product, show what each client paid on their last 2 purchases
  const clientComparisons = customers.map(cust => {
    const custHist = priceHistories
      .filter(ph => ph.product_id === selectedProductId && ph.customer_id === cust.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (custHist.length === 0) return null;

    const latest = custHist[custHist.length - 1];
    const previous = custHist[custHist.length - 2];

    const currentPrice = latest.internal_unit_price;
    const prevPrice = previous ? previous.internal_unit_price : null;
    const diffAbs = prevPrice !== null ? currentPrice - prevPrice : 0;
    const diffPct = prevPrice !== null && prevPrice > 0 ? (diffAbs / prevPrice) * 100 : 0;

    return {
      customerId: cust.id,
      customerName: cust.name,
      lastPurchaseDate: latest.date,
      quantity: latest.internal_quantity,
      currentPrice,
      prevPrice,
      diffAbs,
      diffPct
    };
  })
  .filter(Boolean) as Array<{
    customerId: string;
    customerName: string;
    lastPurchaseDate: string;
    quantity: number;
    currentPrice: number;
    prevPrice: number | null;
    diffAbs: number;
    diffPct: number;
  }>;

  // Apply variance filters
  const filteredComparisons = clientComparisons.filter(item => {
    if (filterVariance === 'up') return item.diffPct > 0;
    if (filterVariance === 'down') return item.diffPct < 0;
    return true;
  });

  // Chart Data preparation
  // Group by date and client
  const chartData = filteredHistories.map(ph => {
    const cust = customers.find(c => c.id === ph.customer_id);
    const [year, month, day] = ph.date.split('-');
    return {
      date: `${day}/${month}/${year.substring(2)}`,
      Preço: ph.internal_unit_price,
      Cliente: cust ? cust.name : 'Outros',
      Qtd: ph.internal_quantity
    };
  });

  // Generate alerts for the selected product
  const productAlerts = (() => {
    const list: string[] = [];
    if (!selectedProductId) return list;

    // Check general increase
    if (filteredHistories.length >= 2) {
      const latest = filteredHistories[filteredHistories.length - 1].internal_unit_price;
      const prev = filteredHistories[filteredHistories.length - 2].internal_unit_price;
      if (prev > 0) {
        const pct = ((latest - prev) / prev) * 100;
        if (pct >= 10) {
          list.push(`Alerta de Custo: O preço geral aumentou +${pct.toFixed(1)}% na última compra.`);
        } else if (pct <= -10) {
          list.push(`Alerta Comercial: O preço geral caiu ${pct.toFixed(1)}% na última compra.`);
        }
      }
    }

    // Check customers who stopped buying this product
    const currentDate = new Date('2026-05-28');
    clientComparisons.forEach(c => {
      const lastDate = new Date(c.lastPurchaseDate);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 60) {
        list.push(`Inatividade: O cliente "${c.customerName}" não compra este produto há ${diffDays} dias.`);
      }
    });

    return list;
  })();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Histórico & Comparativo de Preços</h2>
        <p className="text-sm text-slate-400 mt-1">Selecione um produto para comparar os preços praticados entre diferentes clientes e mapear flutuações.</p>
      </div>

      {/* Selectors Bar */}
      <div className="glass-panel rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Product selection */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-brand-500" /> Selecione o Produto
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors"
          >
            <option value="" disabled>Selecione um produto...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code || 'S/C'})</option>
            ))}
          </select>
        </div>

        {/* Customer selection */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-accent-cyan" /> Filtrar por Cliente (Gráfico)
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors"
          >
            <option value="all">Todos os clientes</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Variance filter */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-accent-emerald" /> Variação de Preços (Tabela)
          </label>
          <select
            value={filterVariance}
            onChange={(e) => setFilterVariance(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors"
          >
            <option value="all">Ver todas as flutuações</option>
            <option value="up">Apenas aumentos (+%)</option>
            <option value="down">Apenas quedas (-%)</option>
          </select>
        </div>
      </div>

      {activeProduct ? (
        <div className="space-y-6">
          {/* Alerts Box */}
          {productAlerts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Alertas Comerciais Detectados para "{activeProduct.name}"</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] space-y-1 leading-relaxed">
                {productAlerts.map((alertText, idx) => (
                  <li key={idx}>{alertText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Chart and KPIs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart Area */}
            <div className="glass-panel rounded-2xl p-5 lg:col-span-2 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-brand-500" />
                Tendência de Preços: {activeProduct.name}
              </h4>
              <div className="h-64">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                        formatter={(value, _, props) => [formatCurrency(parseFloat(value as string)), `${props.payload.Cliente} (${props.payload.Qtd} un)`]}
                      />
                      <Line type="monotone" dataKey="Preço" stroke="#6366f1" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Nenhum histórico comercial encontrado para os filtros selecionados.
                  </div>
                )}
              </div>
            </div>

            {/* Spec Panel */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-accent-cyan" />
                Resumo de Custo
              </h4>

              {/* Price analytics details */}
              {filteredHistories.length > 0 ? (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 text-center">
                      <span className="text-[9px] text-slate-500 uppercase block font-semibold">Menor Histórico</span>
                      <span className="text-sm font-bold text-white mt-1 block">{formatCurrency(Math.min(...filteredHistories.map(h => h.internal_unit_price)))}</span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 text-center">
                      <span className="text-[9px] text-slate-500 uppercase block font-semibold">Maior Histórico</span>
                      <span className="text-sm font-bold text-white mt-1 block">{formatCurrency(Math.max(...filteredHistories.map(h => h.internal_unit_price)))}</span>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cód. Interno:</span>
                      <span className="font-mono text-slate-200">{activeProduct.code || 'S/C'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unidade Interna (Cálculo):</span>
                      <span className="font-bold text-brand-400">{activeProduct.default_internal_unit || 'UN'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Categoria:</span>
                      <span>{activeProduct.category}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850 pt-3">
                      <span className="text-slate-500">Última compra:</span>
                      <span className="font-mono text-slate-200">{filteredHistories[filteredHistories.length - 1].date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Preço atual:</span>
                      <span className="font-bold text-white">{formatCurrency(filteredHistories[filteredHistories.length - 1].internal_unit_price)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-10 italic">
                  Sem faturamentos.
                </div>
              )}
            </div>

          </div>

          {/* Detailed conversion history */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-brand-500" />
              Histórico Detalhado de Conversões
            </h4>

            <div className="overflow-x-auto no-scrollbar border border-slate-800/40 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3 text-center border-l border-slate-800/50">Un. Comercial</th>
                    <th className="py-2.5 px-3 text-center">Qtd Comercial</th>
                    <th className="py-2.5 px-3 text-right">Preço Emb.</th>
                    <th className="py-2.5 px-3 text-right">Total Comercial</th>
                    <th className="py-2.5 px-3 text-center border-l border-brand-900/20 bg-brand-900/10 text-brand-400">Un/Emb</th>
                    <th className="py-2.5 px-3 text-center bg-brand-900/10 text-brand-400">Qtd Interna</th>
                    <th className="py-2.5 px-3 text-center bg-brand-900/10 text-brand-400">Un. Interna</th>
                    <th className="py-2.5 px-3 text-right bg-brand-900/10 text-brand-400">Preço Interno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {filteredHistories.map((history) => {
                    const customer = customers.find(c => c.id === history.customer_id);
                    return (
                      <tr key={history.id} className="hover:bg-slate-900/10">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{history.date}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-200">{customer?.name || 'Cliente'}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold border-l border-slate-800/50">{history.commercial_unit || 'UN'}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300 font-mono">{history.commercial_quantity}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{formatCurrency(history.commercial_unit_price)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{formatCurrency(history.commercial_total_price)}</td>
                        <td className="py-2.5 px-3 text-center text-amber-300 font-bold border-l border-brand-900/20 bg-brand-900/5">{history.units_per_package}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-400/80 font-mono bg-brand-900/5">{history.internal_quantity}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-500 font-bold bg-brand-900/5">{history.internal_unit || 'UN'}</td>
                        <td className="py-2.5 px-3 text-right font-outfit text-emerald-400 font-bold bg-brand-900/5">{formatCurrency(history.internal_unit_price)}</td>
                      </tr>
                    );
                  })}
                  {filteredHistories.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-slate-500 text-xs">
                        Nenhum histórico encontrado para os filtros ativos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparisons Table */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-accent-emerald" />
              Comparativo de Preços Mapeados por Cliente
            </h4>

            <div className="overflow-x-auto no-scrollbar border border-slate-800/40 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30">
                    <th className="py-2.5 px-4">Cliente</th>
                    <th className="py-2.5 px-4 text-center">Última Compra</th>
                    <th className="py-2.5 px-4 text-center">Qtd Compra</th>
                    <th className="py-2.5 px-4 text-right">Preço Anterior (R$)</th>
                    <th className="py-2.5 px-4 text-right">Preço Atual (R$)</th>
                    <th className="py-2.5 px-4 text-right">Variação Absoluta (R$)</th>
                    <th className="py-2.5 px-4 text-right">Variação Percentual (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {filteredComparisons.map((item) => {
                    const isUp = item.diffPct > 0;
                    const isDown = item.diffPct < 0;
                    return (
                      <tr key={item.customerId} className="hover:bg-slate-900/10">
                        <td className="py-2.5 px-4 font-medium text-slate-200">{item.customerName}</td>
                        <td className="py-2.5 px-4 text-center text-slate-400 font-mono">{item.lastPurchaseDate}</td>
                        <td className="py-2.5 px-4 text-center text-slate-300 font-mono">{item.quantity} {activeProduct.default_internal_unit || 'UN'}</td>
                        <td className="py-2.5 px-4 text-right text-slate-400">
                          {item.prevPrice !== null ? formatCurrency(item.prevPrice) : 'Primeira compra'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-outfit text-white font-bold">{formatCurrency(item.currentPrice)}</td>
                        <td className={`py-2.5 px-4 text-right ${
                          isUp ? 'text-rose-400' : isDown ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {item.prevPrice !== null ? formatSignedCurrency(item.diffAbs) : '-'}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-semibold ${
                          isUp ? 'text-rose-400 bg-rose-500/5' : isDown ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-400'
                        }`}>
                          {item.prevPrice !== null ? `${isUp ? '+' : ''}${item.diffPct.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredComparisons.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                        Nenhum cliente realizou compras deste produto com base nos filtros ativos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-10 text-center text-slate-500 text-xs">
          Cadastre produtos ou faça upload de notas para habilitar o painel comparativo de preços.
        </div>
      )}
    </div>
  );
}
