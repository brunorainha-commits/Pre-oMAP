import { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Mail, 
  Phone, 
  TrendingUp, 
  FileText, 
  UserPlus, 
  Edit, 
  Trash2, 
  ArrowLeft,
  AlertTriangle,
  ChevronRight,
  X
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/db';
import type { Customer } from '../services/db';


interface CustomersPageProps {
  userRole: string;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
}

export function CustomersPage({ userRole, selectedCustomerId, setSelectedCustomerId }: CustomersPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterVolume, setFilterVolume] = useState('all'); // all, high, low

  // Form states (Create / Edit modal)
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formDoc, setFormDoc] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const isAdmin = userRole === 'admin';
  const canEdit = userRole === 'admin' || userRole === 'operator';

  useEffect(() => {
    setCustomers(db.getCustomers());
  }, [showModal, selectedCustomerId]);

  const loadCustomersList = () => {
    setCustomers(db.getCustomers());
  };

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormDoc('');
    setFormEmail('');
    setFormPhone('');
    setFormCity('');
    setFormState('');
    setFormNotes('');
    setShowModal(true);
  };

  const handleOpenEdit = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormDoc(cust.document || '');
    setFormEmail(cust.email || '');
    setFormPhone(cust.phone || '');
    setFormCity(cust.city || '');
    setFormState(cust.state || '');
    setFormNotes(cust.notes || '');
    setShowModal(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert("Apenas administradores podem excluir clientes.");
      return;
    }
    if (confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) {
      const deleted = db.deleteCustomer(id);
      if (deleted) {
        alert("Cliente excluído com sucesso.");
        if (selectedCustomerId === id) setSelectedCustomerId(null);
        loadCustomersList();
      } else {
        alert("Não é possível excluir este cliente pois ele possui pedidos vinculados.");
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const timestamp = new Date().toISOString();
    const customerData: Customer = {
      id: editingCustomer ? editingCustomer.id : `cust-${Math.random().toString(36).substring(2, 9)}`,
      name: formName,
      document: formDoc || null,
      email: formEmail || null,
      phone: formPhone || null,
      city: formCity || null,
      state: formState || null,
      notes: formNotes || null,
      first_purchase_date: editingCustomer ? editingCustomer.first_purchase_date : null,
      last_purchase_date: editingCustomer ? editingCustomer.last_purchase_date : null,
      total_orders: editingCustomer ? editingCustomer.total_orders : 0,
      total_amount: editingCustomer ? editingCustomer.total_amount : 0,
      created_at: editingCustomer ? editingCustomer.created_at : timestamp,
      updated_at: timestamp
    };

    db.saveCustomer(customerData);
    setShowModal(false);
    loadCustomersList();
  };

  // Filtered List
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.document && c.document.replace(/\D/g, '').includes(search.replace(/\D/g, '')));
    
    const matchesCity = !filterCity || (c.city && c.city.toLowerCase().includes(filterCity.toLowerCase()));
    const matchesState = !filterState || (c.state && c.state.toUpperCase() === filterState.toUpperCase());
    
    let matchesVolume = true;
    if (filterVolume === 'high') matchesVolume = c.total_amount >= 10000;
    if (filterVolume === 'low') matchesVolume = c.total_amount < 10000;

    return matchesSearch && matchesCity && matchesState && matchesVolume;
  });

  // Render detail view if a customer is selected
  if (selectedCustomerId) {
    const cust = db.getCustomerById(selectedCustomerId);
    if (!cust) {
      return (
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Cliente não encontrado.</p>
          <button onClick={() => setSelectedCustomerId(null)} className="text-brand-400 font-semibold hover:underline mt-2">
            Voltar para lista
          </button>
        </div>
      );
    }

    const allOrders = db.getOrders();
    const custOrders = allOrders
      .filter(o => o.customer_id === cust.id)
      .sort((a, b) => new Date(b.issue_date || '').getTime() - new Date(a.issue_date || '').getTime());

    const allPriceHistory = db.getPriceHistory();
    const custPriceHistory = allPriceHistory
      .filter(ph => ph.customer_id === cust.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group customer purchases by month for Area Chart
    const monthlyDataMap: Record<string, number> = {};
    custOrders.forEach(o => {
      if (!o.issue_date) return;
      const month = o.issue_date.substring(0, 7); // "YYYY-MM"
      monthlyDataMap[month] = (monthlyDataMap[month] || 0) + o.total_amount;
    });

    const chartData = Object.keys(monthlyDataMap)
      .sort()
      .map(month => {
        const [year, m] = month.split('-');
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return {
          month: `${monthNames[parseInt(m) - 1]}/${year.substring(2)}`,
          Valor: parseFloat(monthlyDataMap[month].toFixed(2))
        };
      });

    // Check Inactivity alert manually
    const daysSinceLastPurchase = (() => {
      if (!cust.last_purchase_date) return 999;
      const lastDate = new Date(cust.last_purchase_date);
      const diffTime = Math.abs(new Date('2026-05-28').getTime() - lastDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    })();

    const isInactive = daysSinceLastPurchase >= 30;

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Detail Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedCustomerId(null)}
            className="p-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold font-outfit text-white tracking-wide">{cust.name}</h2>
            <span className="text-xs text-slate-500 font-mono">ID: {cust.id} • Cadastrado em {new Date(cust.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Inactivity Warning */}
        {isInactive && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-semibold block text-rose-300">Cliente Alerta de Inatividade</strong>
              Este cliente está inativo há <span className="font-bold">{daysSinceLastPurchase} dias</span> (última compra em {cust.last_purchase_date || 'n/a'}). Entre em contato com a equipe comercial.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Customer details card */}
          <div className="glass-panel rounded-2xl p-5 space-y-4 h-fit">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
              <span>Ficha Cadastral</span>
              {canEdit && (
                <button 
                  onClick={(e) => handleOpenEdit(cust, e)}
                  className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
                >
                  <Edit className="w-3 h-3" /> Editar
                </button>
              )}
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Razão Social:</span>
                <span className="font-semibold text-right max-w-[150px]">{cust.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Documento:</span>
                <span className="font-mono text-slate-200">{cust.document || 'S/D'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-500" /> Cidade:</span>
                <span>{cust.city ? `${cust.city} - ${cust.state || ''}` : 'Não informado'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-500" /> Email:</span>
                <span className="truncate max-w-[160px] text-slate-200" title={cust.email || ''}>{cust.email || 'Não informado'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-500" /> Telefone:</span>
                <span>{cust.phone || 'Não informado'}</span>
              </div>
              <div className="flex flex-col gap-1 border-t border-slate-800 pt-3 mt-1">
                <span className="text-slate-500">Observações:</span>
                <p className="text-[11px] text-slate-400 leading-normal italic">{cust.notes || 'Sem observações cadastradas.'}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Analysis dashboard */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Sales metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Comprado</span>
                <div className="text-base font-bold font-outfit text-white mt-1">R$ {cust.total_amount.toFixed(2)}</div>
              </div>
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Pedidos</span>
                <div className="text-base font-bold font-outfit text-white mt-1">{cust.total_orders}</div>
              </div>
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Ticket Médio</span>
                <div className="text-base font-bold font-outfit text-white mt-1">R$ {cust.total_orders > 0 ? (cust.total_amount / cust.total_orders).toFixed(2) : '0.00'}</div>
              </div>
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Frequência Média</span>
                <div className="text-base font-bold font-outfit text-white mt-1">
                  {cust.total_orders > 1 ? `${Math.round(daysSinceLastPurchase / cust.total_orders)} dias` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Monthly graph of purchase volume */}
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                Histórico de Compras Mensal
              </h4>
              <div className="h-48">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="custVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }} />
                      <Area type="monotone" dataKey="Valor" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#custVal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Sem histórico de faturamento para gerar gráfico.
                  </div>
                )}
              </div>
            </div>

            {/* Product Purchase Logs */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-accent-cyan" />
                Produtos Adquiridos & Histórico de Preços
              </h4>
              <div className="max-h-60 overflow-y-auto no-scrollbar border border-slate-800/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30">
                      <th className="py-2.5 px-3">Produto</th>
                      <th className="py-2.5 px-3 text-center">Data</th>
                      <th className="py-2.5 px-3 text-center">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Preço Unitário</th>
                      <th className="py-2.5 px-3 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/20">
                    {custPriceHistory.map((ph, idx) => {
                      const prodName = db.getProductById(ph.product_id)?.name || 'Produto';
                      return (
                        <tr key={idx} className="hover:bg-slate-900/10">
                          <td className="py-2.5 px-3 font-medium text-slate-200">{prodName}</td>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{ph.date}</td>
                          <td className="py-2.5 px-3 text-center text-slate-300">{ph.quantity}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">R$ {ph.unit_price.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-outfit text-white font-semibold">R$ {ph.total_price.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {custPriceHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-xs text-slate-500">
                          Nenhum produto registrado neste cliente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historical Orders */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-accent-emerald" />
                Histórico de Pedidos / Notas
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                {custOrders.map(o => (
                  <div 
                    key={o.id}
                    onClick={() => {}}
                    className="p-3 bg-slate-900/40 border border-slate-850 hover:bg-slate-800/30 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">Nota: {o.invoice_number || 'S/N'} ({o.order_number})</div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Emissão: {o.issue_date} • {o.source_file_type.toUpperCase()}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-outfit font-bold text-white">R$ {o.total_amount.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                {custOrders.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Nenhum pedido importado para este cliente.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Render List View
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* List Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Base de Clientes</h2>
          <p className="text-sm text-slate-400 mt-1">Consulte o histórico de compras, ticket médio, recorrências e alertas de inatividade.</p>
        </div>

        {canEdit && (
          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/10 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Adicionar Cliente Manual</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* City Filter */}
        <input
          type="text"
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          placeholder="Cidade..."
          className="w-full md:w-32 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none transition-colors"
        />

        {/* State Filter */}
        <input
          type="text"
          value={filterState}
          maxLength={2}
          onChange={(e) => setFilterState(e.target.value.toUpperCase())}
          placeholder="UF..."
          className="w-full md:w-16 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 text-center focus:outline-none transition-colors"
        />

        {/* Volume Filter */}
        <select
          value={filterVolume}
          onChange={(e) => setFilterVolume(e.target.value)}
          className="w-full md:w-44 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none transition-colors"
        >
          <option value="all">Volume Financeiro (Todos)</option>
          <option value="high">Alto Volume (&gt;= 10k)</option>
          <option value="low">Baixo Volume (&lt; 10k)</option>
        </select>
      </div>

      {/* Customer List Card */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30">
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Cidade/UF</th>
                <th className="py-3 px-4 text-center">Nº Pedidos</th>
                <th className="py-3 px-4 text-right">Média Ticket</th>
                <th className="py-3 px-4 text-right">Total Acumulado</th>
                <th className="py-3 px-4 text-center">Última Compra</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredCustomers.map((cust) => {
                const ticket = cust.total_orders > 0 ? cust.total_amount / cust.total_orders : 0;
                return (
                  <tr 
                    key={cust.id} 
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="hover:bg-slate-900/20 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">{cust.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{cust.document || 'S/D'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {cust.city ? `${cust.city}/${cust.state || ''}` : 'Não informado'}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-300">
                      {cust.total_orders}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      R$ {ticket.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-outfit text-white font-bold">
                      R$ {cust.total_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">
                      {cust.last_purchase_date || 'Sem compras'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <button
                            onClick={(e) => handleOpenEdit(cust, e)}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800"
                            title="Editar cliente"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(cust.id, e)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800"
                            title="Excluir cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 text-xs">
                    Nenhum cliente cadastrado ainda. Envie uma nota fiscal para criar clientes automaticamente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="glass-panel border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-outfit uppercase tracking-wider">
                {editingCustomer ? 'Editar Ficha Cliente' : 'Adicionar Novo Cliente'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Nome / Razão Social</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">CPF / CNPJ</label>
                <input
                  type="text"
                  value={formDoc}
                  onChange={(e) => setFormDoc(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Telefone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Cidade</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">UF</label>
                  <input
                    type="text"
                    value={formState}
                    maxLength={2}
                    onChange={(e) => setFormState(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white text-center focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Observações Comerciais</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-3">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-brand-600/10 transition-colors"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
