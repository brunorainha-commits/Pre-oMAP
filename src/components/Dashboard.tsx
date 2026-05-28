import { 
  Users, 
  Package, 
  FileText, 
  DollarSign, 
  Percent, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { db } from '../services/db';
import { getActionableAlerts } from '../services/alerts';
import type { CommercialAlert } from '../services/alerts';
import { formatCurrency } from '../services/formatters';

interface DashboardProps {
  setCurrentTab: (tab: string) => void;
  onSelectCustomer: (id: string) => void;
  onSelectProduct: (id: string) => void;
  onSelectOrder: (id: string) => void;
  alerts: CommercialAlert[];
}

export function Dashboard({ 
  setCurrentTab, 
  onSelectCustomer, 
  onSelectProduct, 
  onSelectOrder,
  alerts
}: DashboardProps) {
  const customers = db.getCustomers();
  const products = db.getProducts();
  const orders = db.getOrders();
  const orderItems = db.getOrderItems();

  // 1. Calculations KPIs
  const totalCustomers = customers.length;
  const totalProducts = products.length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 2. Gráficos: Evolução Mensal
  // Group orders by Month (YYYY-MM)
  const monthlyDataMap: Record<string, { month: string; value: number; count: number }> = {};
  orders.forEach(o => {
    if (!o.issue_date) return;
    const monthKey = o.issue_date.substring(0, 7); // "YYYY-MM"
    if (!monthlyDataMap[monthKey]) {
      // Format as "Jan/26", "Fev/26", etc.
      const [year, month] = monthKey.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const formattedMonth = `${monthNames[parseInt(month) - 1]}/${year.substring(2)}`;
      
      monthlyDataMap[monthKey] = {
        month: formattedMonth,
        value: 0,
        count: 0
      };
    }
    monthlyDataMap[monthKey].value += o.total_amount;
    monthlyDataMap[monthKey].count += 1;
  });

  // Sort months chronologically
  const monthlyData = Object.keys(monthlyDataMap)
    .sort()
    .map(key => ({
      month: monthlyDataMap[key].month,
      Valor: parseFloat(monthlyDataMap[key].value.toFixed(2)),
      Pedidos: monthlyDataMap[key].count
    }));

  // 3. Gráficos: Ranking de Clientes por Valor
  const customerRankings = customers
    .map(c => ({
      name: c.name.length > 20 ? c.name.substring(0, 18) + '...' : c.name,
      id: c.id,
      Valor: parseFloat(c.total_amount.toFixed(2))
    }))
    .sort((a, b) => b.Valor - a.Valor)
    .slice(0, 5);

  // 4. Gráficos: Ranking de Produtos por Quantidade
  const productQuantities: Record<string, { name: string; id: string; Qtd: number }> = {};
  orderItems.forEach(item => {
    if (!productQuantities[item.product_id]) {
      productQuantities[item.product_id] = {
        name: item.description.length > 20 ? item.description.substring(0, 18) + '...' : item.description,
        id: item.product_id,
        Qtd: 0
      };
    }
    productQuantities[item.product_id].Qtd += item.internal_quantity;
  });

  const productRankings = Object.values(productQuantities)
    .sort((a, b) => b.Qtd - a.Qtd)
    .slice(0, 5);

  // 5. Price Variations Alertas
  const priceAlerts = alerts.filter(a => a.type === 'price_increase' || a.type === 'price_decrease').slice(0, 4);
  const actionableAlerts = getActionableAlerts(alerts);
  const highAlertsCount = alerts.filter(a => a.severity === 'high').length;
  const mediumAlertsCount = alerts.filter(a => a.severity === 'medium').length;
  const alertSummary = highAlertsCount > 0
    ? `Atenção: ${highAlertsCount} ${highAlertsCount === 1 ? 'alerta crítico precisa' : 'alertas críticos precisam'} de análise.`
    : `${mediumAlertsCount} ${mediumAlertsCount === 1 ? 'alerta de atenção merece' : 'alertas de atenção merecem'} revisão.`;

  // 6. Latest Orders
  const latestOrders = [...orders]
    .sort((a, b) => new Date(b.issue_date || '').getTime() - new Date(a.issue_date || '').getTime())
    .slice(0, 5);

  // Colors for charts
  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Painel Geral</h2>
        <p className="text-sm text-slate-400 mt-1">Visão analítica de faturamentos, preços e comportamento de clientes.</p>
      </div>

      {/* Alert Banner for system notifications */}
      {actionableAlerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-5 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              {alertSummary} Informativos de baixa prioridade ficam apenas na central de alertas.
            </span>
          </div>
          <button 
            onClick={() => setCurrentTab('alerts')}
            className="self-end sm:self-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3.5 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap"
          >
            Visualizar Alertas
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        
        {/* Total Vendido */}
        <div className="glass-panel rounded-2xl p-5 glow-primary transition-all hover:translate-y-[-2px] border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-outfit">Total Vendido</span>
            <div className="p-2 bg-brand-500/10 rounded-xl text-brand-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-white font-outfit">{formatCurrency(totalRevenue)}</h3>
            <span className="text-[10px] text-accent-emerald flex items-center gap-0.5 mt-1 font-medium">
              <TrendingUp className="w-3 h-3" /> Faturamento consolidado
            </span>
          </div>
        </div>

        {/* Clientes Cadastrados */}
        <div className="glass-panel rounded-2xl p-5 transition-all hover:translate-y-[-2px] border-l-4 border-l-accent-cyan">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-outfit">Clientes</span>
            <div className="p-2 bg-accent-cyan/10 rounded-xl text-accent-cyan">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-white font-outfit">{totalCustomers}</h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1">
              Clientes cadastrados na base
            </span>
          </div>
        </div>

        {/* Produtos Ativos */}
        <div className="glass-panel rounded-2xl p-5 transition-all hover:translate-y-[-2px] border-l-4 border-l-accent-emerald">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-outfit">Produtos</span>
            <div className="p-2 bg-accent-emerald/10 rounded-xl text-accent-emerald">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-white font-outfit">{totalProducts}</h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1">
              Catálogo de itens catalogados
            </span>
          </div>
        </div>

        {/* Pedidos Importados */}
        <div className="glass-panel rounded-2xl p-5 transition-all hover:translate-y-[-2px] border-l-4 border-l-accent-amber">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-outfit">Notas / Pedidos</span>
            <div className="p-2 bg-accent-amber/10 rounded-xl text-accent-amber">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-white font-outfit">{totalOrders}</h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1">
              Total de documentos importados
            </span>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="glass-panel rounded-2xl p-5 transition-all hover:translate-y-[-2px] border-l-4 border-l-accent-rose">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider font-outfit">Ticket Médio</span>
            <div className="p-2 bg-accent-rose/10 rounded-xl text-accent-rose">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-white font-outfit">{formatCurrency(averageTicket)}</h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1">
              Valor médio por pedido/nota
            </span>
          </div>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Evolução Mensal - Area Chart */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold font-outfit text-white">Evolução Mensal de Compras</h4>
              <p className="text-xs text-slate-400">Faturamento acumulado por mês.</p>
            </div>
          </div>
          <div className="h-72">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="Valor" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Nenhum dado de pedido disponível ainda.
              </div>
            )}
          </div>
        </div>

        {/* Ranking Clientes - Bar Chart */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold font-outfit text-white">Top Clientes por Valor</h4>
            <p className="text-xs text-slate-400">Clientes de maior volume financeiro.</p>
          </div>
          <div className="h-72">
            {customerRankings.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerRankings} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.4)" fontSize={9} width={70} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  />
                  <Bar dataKey="Valor" radius={[0, 4, 4, 0]}>
                    {customerRankings.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        onClick={() => handleCustomerClick(entry.id)}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Nenhum dado de cliente cadastrado.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Price Variations and Product Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Products - Volume */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold font-outfit text-white">Top Produtos por Quantidade</h4>
            <p className="text-xs text-slate-400">Produtos com maior volume de unidades.</p>
          </div>
          <div className="h-64">
            {productRankings.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productRankings} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  />
                  <Bar dataKey="Qtd" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                    {productRankings.map((entry, index) => (
                      <Cell key={`cell-${index}`} onClick={() => handleProductClick(entry.id)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Nenhum dado de produto.
              </div>
            )}
          </div>
        </div>

        {/* Price Variation Alerts */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold font-outfit text-white">Oscilações Recentes de Preços</h4>
              <p className="text-xs text-slate-400">Variações significativas detectadas.</p>
            </div>
            <button 
              onClick={() => setCurrentTab('alerts')}
              className="text-[11px] font-semibold text-brand-400 hover:underline"
            >
              Ver mais
            </button>
          </div>
          <div className="space-y-3 h-64 overflow-y-auto no-scrollbar">
            {priceAlerts.length > 0 ? (
              priceAlerts.map((alert) => {
                const isUp = alert.type === 'price_increase';
                return (
                  <div 
                    key={alert.id}
                    onClick={() => handleProductClick(alert.target_id)}
                    className="p-3 bg-slate-900/40 border border-slate-800/80 hover:bg-slate-800/40 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-200 truncate">{db.getProductById(alert.target_id)?.name || 'Produto'}</div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Variação no preço unitário</span>
                    </div>
                    <div className={`shrink-0 flex items-center gap-1 font-outfit font-bold text-xs px-2.5 py-1 rounded-lg ${
                      isUp ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{isUp ? '+' : ''}{alert.meta?.varPct?.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Nenhuma oscilação expressiva (&gt;10%) detectada.
              </div>
            )}
          </div>
        </div>

        {/* Latest Imported Invoices */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold font-outfit text-white">Últimas Importações</h4>
              <p className="text-xs text-slate-400">Documentos recentes processados.</p>
            </div>
            <button 
              onClick={() => setCurrentTab('orders')}
              className="text-[11px] font-semibold text-brand-400 hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="space-y-3 h-64 overflow-y-auto no-scrollbar">
            {latestOrders.length > 0 ? (
              latestOrders.map((order) => {
                const cust = db.getCustomerById(order.customer_id);
                const isXml = order.source_file_type === 'xml';
                return (
                  <div 
                    key={order.id}
                    onClick={() => handleOrderClick(order.id)}
                    className="p-3 bg-slate-900/40 border border-slate-800/80 hover:bg-slate-800/40 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-200 truncate">{cust?.name || 'Cliente Desconhecido'}</div>
                      <span className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${isXml ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                          {isXml ? 'XML' : 'Manual'}
                        </span>
                        Nota: {order.invoice_number || 'S/N'} • {order.issue_date}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-bold text-white font-outfit">{formatCurrency(order.total_amount)}</div>
                      <span className="text-[9px] text-accent-cyan flex items-center justify-end font-medium mt-0.5">
                        Ver <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
                Nenhum pedido importado ainda. Comece enviando seu primeiro XML.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  function handleCustomerClick(id: string) {
    onSelectCustomer(id);
    setCurrentTab('customers');
  }

  function handleProductClick(id: string) {
    onSelectProduct(id);
    setCurrentTab('products');
  }

  function handleOrderClick(id: string) {
    onSelectOrder(id);
    setCurrentTab('orders');
  }
}
