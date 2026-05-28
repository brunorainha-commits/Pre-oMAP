import { useState, useEffect } from 'react';
import { 
  Search, 
  Tag, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft,
  ChevronRight,
  Edit,
  Trash2,
  Plus,
  X
} from 'lucide-react';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/db';
import type { Product } from '../services/db';
import { detectPackagingUnit, getNormalizedDescription } from '../services/normalizer';
import { formatCurrency } from '../services/formatters';


interface ProductsPageProps {
  userRole: string;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
}

export function ProductsPage({ userRole, selectedProductId, setSelectedProductId }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');

  // Form states (Create / Edit modal)
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formInternalUnit, setFormInternalUnit] = useState('');
  const [formUpp, setFormUpp] = useState<number>(1);
  const [formLastPackagePrice, setFormLastPackagePrice] = useState<number>(0);
  const [formLastInternalUnitPrice, setFormLastInternalUnitPrice] = useState<number>(0);
  const [formAveragePackagePrice, setFormAveragePackagePrice] = useState<number>(0);
  const [formAverageInternalUnitPrice, setFormAverageInternalUnitPrice] = useState<number>(0);
  const [formMinInternalUnitPrice, setFormMinInternalUnitPrice] = useState<number>(0);
  const [formMaxInternalUnitPrice, setFormMaxInternalUnitPrice] = useState<number>(0);
  const [formNcm, setFormNcm] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const isAdmin = userRole === 'admin';
  const canEdit = userRole === 'admin' || userRole === 'operator';

  useEffect(() => {
    setProducts(db.getProducts());
  }, [showModal, selectedProductId]);

  const loadProductsList = () => {
    setProducts(db.getProducts());
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCode('');
    setFormBarcode('');
    setFormCategory('');
    setFormBrand('');
    setFormUnit('');
    setFormInternalUnit('');
    setFormUpp(1);
    setFormLastPackagePrice(0);
    setFormLastInternalUnitPrice(0);
    setFormAveragePackagePrice(0);
    setFormAverageInternalUnitPrice(0);
    setFormMinInternalUnitPrice(0);
    setFormMaxInternalUnitPrice(0);
    setFormNcm('');
    setFormNotes('');
    setShowModal(true);
  };

  const handleOpenEdit = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormCode(prod.code || '');
    setFormBarcode(prod.barcode || '');
    setFormCategory(prod.category || '');
    setFormBrand(prod.brand || '');
    setFormUnit(prod.default_commercial_unit || '');
    setFormInternalUnit(prod.default_internal_unit || '');
    setFormUpp(prod.units_per_package || 1);
    setFormLastPackagePrice(prod.last_package_price || 0);
    setFormLastInternalUnitPrice(prod.last_internal_unit_price || 0);
    setFormAveragePackagePrice(prod.average_package_price || 0);
    setFormAverageInternalUnitPrice(prod.average_internal_unit_price || 0);
    setFormMinInternalUnitPrice(prod.min_internal_unit_price || 0);
    setFormMaxInternalUnitPrice(prod.max_internal_unit_price || 0);
    setFormNcm(prod.ncm || '');
    setFormNotes(prod.notes || '');
    setShowModal(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert("Apenas administradores podem excluir produtos.");
      return;
    }
    if (confirm("Deseja realmente excluir este produto?")) {
      try {
        db.deleteProduct(id);
        alert("Produto excluído com sucesso.");
        if (selectedProductId === id) setSelectedProductId(null);
        loadProductsList();
      } catch (error: any) {
        alert(`Não foi possível excluir o produto. ${error.message}`);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (detectPackagingUnit(formUnit) && formUpp <= 1) {
      alert('Informe quantas unidades existem dentro desta embalagem.');
      return;
    }

    const timestamp = new Date().toISOString();
    const normalizedName = editingProduct ? editingProduct.normalized_name : getNormalizedDescription(formName);
    const productData: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Math.random().toString(36).substring(2, 9)}`,
      name: formName,
      normalized_name: normalizedName,
      code: formCode || null,
      barcode: formBarcode || null,
      category: formCategory || 'Não Categorizado',
      brand: formBrand || null,
      default_commercial_unit: formUnit || 'UN',
      default_internal_unit: formInternalUnit || 'UN',
      units_per_package: formUpp > 0 ? formUpp : 1,
      last_package_price: formLastPackagePrice,
      last_internal_unit_price: formLastInternalUnitPrice,
      average_package_price: formAveragePackagePrice,
      average_internal_unit_price: formAverageInternalUnitPrice,
      min_internal_unit_price: formMinInternalUnitPrice,
      max_internal_unit_price: formMaxInternalUnitPrice,
      ncm: formNcm || null,
      notes: formNotes || null,
      first_seen_at: editingProduct ? editingProduct.first_seen_at : null,
      last_seen_at: editingProduct ? editingProduct.last_seen_at : null,
      created_at: editingProduct ? editingProduct.created_at : timestamp,
      updated_at: timestamp
    };

    db.saveProduct(productData);
    setShowModal(false);
    loadProductsList();
  };

  // Get categories and brands for filter dropdowns
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const brands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))) as string[];

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));

    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesBrand = filterBrand === 'all' || p.brand === filterBrand;

    return matchesSearch && matchesCategory && matchesBrand;
  });

  // Render detail view if a product is selected
  if (selectedProductId) {
    const prod = db.getProductById(selectedProductId);
    if (!prod) {
      return (
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Produto não encontrado.</p>
          <button onClick={() => setSelectedProductId(null)} className="text-brand-400 font-semibold hover:underline mt-2">
            Voltar para lista
          </button>
        </div>
      );
    }

    const priceHistory = db.getPriceHistoryByProduct(prod.id);
    
    // Calculate stats
    const totalQty = priceHistory.reduce((sum, ph) => sum + ph.internal_quantity, 0);
    const totalAmount = priceHistory.reduce((sum, ph) => sum + ph.commercial_total_price, 0);
    const averagePrice = priceHistory.length > 0 ? totalAmount / totalQty : 0;
    
    const prices = priceHistory.map(ph => ph.internal_unit_price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    
    const latestPh = priceHistory[priceHistory.length - 1];
    const latestPrice = latestPh ? latestPh.internal_unit_price : 0;
    
    const previousPh = priceHistory[priceHistory.length - 2];
    const prevPrice = previousPh ? previousPh.internal_unit_price : 0;

    const varPct = prevPrice > 0 ? ((latestPrice - prevPrice) / prevPrice) * 100 : 0;

    // Get list of buyers
    const buyerMap: Record<string, { name: string; lastPurchase: string; qty: number; minP: number; maxP: number; lastP: number; minPUn: number; lastPUn: number }> = {};
    priceHistory.forEach(ph => {
      const cust = db.getCustomerById(ph.customer_id);
      if (!cust) return;
      const calcUnit = ph.internal_unit_price;

      if (!buyerMap[ph.customer_id]) {
        buyerMap[ph.customer_id] = {
          name: cust.name,
          lastPurchase: ph.date,
          qty: 0,
          minP: ph.commercial_unit_price,
          maxP: ph.commercial_unit_price,
          lastP: ph.commercial_unit_price,
          minPUn: calcUnit,
          lastPUn: calcUnit
        };
      }

      const buyer = buyerMap[ph.customer_id];
      buyer.qty += ph.internal_quantity;
      buyer.minP = Math.min(buyer.minP, ph.commercial_unit_price);
      buyer.maxP = Math.max(buyer.maxP, ph.commercial_unit_price);
      buyer.minPUn = Math.min(buyer.minPUn, calcUnit);
      if (new Date(ph.date).getTime() > new Date(buyer.lastPurchase).getTime()) {
        buyer.lastPurchase = ph.date;
        buyer.lastP = ph.commercial_unit_price;
        buyer.lastPUn = calcUnit;
      }
    });

    const buyers = Object.values(buyerMap);

    // Line Chart Data
    const chartData = priceHistory.map(ph => {
      const cust = db.getCustomerById(ph.customer_id);
      const [year, month, day] = ph.date.split('-');
      return {
        date: `${day}/${month}/${year.substring(2)}`,
        Preço: ph.internal_unit_price,
        Cliente: cust ? (cust.name.length > 15 ? cust.name.substring(0, 12) + '...' : cust.name) : 'Outros'
      };
    });

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Detail Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedProductId(null)}
            className="p-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold font-outfit text-white tracking-wide">{prod.name}</h2>
            <span className="text-xs text-slate-500 font-mono">Código: {prod.code || 'S/C'} • Catalogado em {new Date(prod.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Product Details & KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Product Data Spec */}
          <div className="glass-panel rounded-2xl p-5 space-y-4 h-fit">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
              <span>Especificações Técnicas</span>
              {canEdit && (
                <button 
                  onClick={(e) => handleOpenEdit(prod, e)}
                  className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
                >
                  <Edit className="w-3.5 h-3.5" /> Editar
                </button>
              )}
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Nome Comercial:</span>
                <span className="font-semibold text-right max-w-[170px]">{prod.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Código Interno:</span>
                <span className="font-mono text-slate-200">{prod.code || 'Não informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Código de Barras (EAN):</span>
                <span className="font-mono text-slate-200">{prod.barcode || 'Sem GTIN'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NCM:</span>
                <span className="font-mono">{prod.ncm || 'Não informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Categoria / Marca:</span>
                <span>{prod.category} {prod.brand ? ` / ${prod.brand}` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unidade de Medida:</span>
                <span className="font-bold text-brand-400">{prod.default_commercial_unit || 'UN'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unidade Interna:</span>
                <span className="font-bold text-emerald-400">{prod.default_internal_unit || 'UN'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unidades por Embalagem:</span>
                <span className="font-bold text-amber-300">{prod.units_per_package || 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 mt-1">
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2">
                  <span className="text-[9px] text-slate-500 uppercase block">Último preço embalagem</span>
                  <span className="text-[11px] font-bold text-slate-100">{formatCurrency(prod.last_package_price)}</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2">
                  <span className="text-[9px] text-slate-500 uppercase block">Último preço interno</span>
                  <span className="text-[11px] font-bold text-emerald-400">{formatCurrency(prod.last_internal_unit_price)}</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2">
                  <span className="text-[9px] text-slate-500 uppercase block">Média embalagem</span>
                  <span className="text-[11px] font-bold text-slate-100">{formatCurrency(prod.average_package_price)}</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2">
                  <span className="text-[9px] text-slate-500 uppercase block">Média interna</span>
                  <span className="text-[11px] font-bold text-emerald-400">{formatCurrency(prod.average_internal_unit_price)}</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2">
                  <span className="text-[9px] text-slate-500 uppercase block">Menor interno</span>
                  <span className="text-[11px] font-bold text-slate-100">{formatCurrency(prod.min_internal_unit_price)}</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2">
                  <span className="text-[9px] text-slate-500 uppercase block">Maior interno</span>
                  <span className="text-[11px] font-bold text-slate-100">{formatCurrency(prod.max_internal_unit_price)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-slate-800 pt-3 mt-1">
                <span className="text-slate-500">Anotações Comerciais:</span>
                <p className="text-[11px] text-slate-400 leading-normal italic">{prod.notes || 'Sem anotações cadastradas.'}</p>
              </div>
            </div>
          </div>

          {/* Analysis Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Price / Vol stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Preço Médio</span>
                <div className="text-sm font-bold font-outfit text-white mt-1">{formatCurrency(averagePrice)}</div>
              </div>
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Menor Preço</span>
                <div className="text-sm font-bold font-outfit text-white mt-1">{formatCurrency(minPrice)}</div>
              </div>
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Maior Preço</span>
                <div className="text-sm font-bold font-outfit text-white mt-1">{formatCurrency(maxPrice)}</div>
              </div>
              <div className="glass-panel rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Último Preço</span>
                <div className="text-sm font-bold font-outfit text-white mt-1">{formatCurrency(latestPrice)}</div>
              </div>
              {/* Price Change Variance */}
              <div className={`glass-panel rounded-2xl p-4 text-center ${
                varPct > 0 ? 'border-r-2 border-rose-500/35 bg-rose-500/5' : varPct < 0 ? 'border-r-2 border-emerald-500/35 bg-emerald-500/5' : ''
              }`}>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Variação Recente</span>
                <div className={`text-xs font-bold font-outfit flex items-center justify-center gap-0.5 mt-1 ${
                  varPct > 0 ? 'text-rose-400' : varPct < 0 ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {varPct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : varPct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  <span>{varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Price Trend Chart - Line Chart */}
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-brand-500" />
                Curva Histórica de Preços Unitários
              </h4>
              <div className="h-48">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                        formatter={(value, _, props) => [formatCurrency(parseFloat(value as string)), `Preço (${props.payload.Cliente})`]}
                      />
                      <Line type="monotone" dataKey="Preço" stroke="#06b6d4" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Sem transações registradas para gerar curva de preços.
                  </div>
                )}
              </div>
            </div>

            {/* Customers buying this product */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-accent-cyan" />
                Histórico de Preços por Cliente
              </h4>
              <div className="max-h-60 overflow-y-auto no-scrollbar border border-slate-800/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30">
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3 text-center">Volume Comprado</th>
                      <th className="py-2.5 px-3 text-right">Menor Preço (Cx)</th>
                      <th className="py-2.5 px-3 text-right">Último Preço (Cx)</th>
                      <th className="py-2.5 px-3 text-right text-emerald-400">R$ Unidade</th>
                      <th className="py-2.5 px-3 text-center">Data Transação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/20">
                    {buyers.map((buyer, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/10">
                        <td className="py-2.5 px-3 font-medium text-slate-200">{buyer.name}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300 font-mono">{buyer.qty} {prod.default_internal_unit || 'UN'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400">{formatCurrency(buyer.minP)}</td>
                        <td className="py-2.5 px-3 text-right font-outfit text-white font-bold">{formatCurrency(buyer.lastP)}</td>
                        <td className="py-2.5 px-3 text-right font-outfit text-emerald-400 font-bold">{formatCurrency(buyer.lastPUn)}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{buyer.lastPurchase}</td>
                      </tr>
                    ))}
                    {buyers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-xs text-slate-500">
                          Nenhum cliente comprou este produto ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
          <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Catálogo de Produtos</h2>
          <p className="text-sm text-slate-400 mt-1">Monitore preços médios, variações de custo e controle o código de barras.</p>
        </div>

        {canEdit && (
          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto Manual</span>
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
            placeholder="Buscar por nome, código interno ou EAN..."
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full md:w-48 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none transition-colors"
        >
          <option value="all">Categorias (Todas)</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Brand Filter */}
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className="w-full md:w-48 bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none transition-colors"
        >
          <option value="all">Marcas (Todas)</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Product List Card */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-[9px] uppercase font-bold bg-slate-900/30">
                <th className="py-3 px-4 w-1/4">Produto</th>
                <th className="py-3 px-4 w-1/6">Código / EAN</th>
                <th className="py-3 px-4 text-center">Un/Emb</th>
                <th className="py-3 px-4 text-center border-l border-slate-800/50 bg-slate-900/40">Un. Comercial</th>
                <th className="py-3 px-4 text-right bg-slate-900/40">Último R$ (Emb)</th>
                <th className="py-3 px-4 text-center border-l border-brand-900/20 bg-brand-900/10 text-brand-400">Interna</th>
                <th className="py-3 px-4 text-right bg-brand-900/10 text-brand-400">Médio R$ (Un)</th>
                <th className="py-3 px-4 text-right bg-brand-900/10 text-brand-400">Último R$ (Un)</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredProducts.map((prod) => {
                return (
                  <tr 
                    key={prod.id} 
                    onClick={() => setSelectedProductId(prod.id)}
                    className="hover:bg-slate-900/20 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">{prod.name}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      <div>Cód: {prod.code || 'S/C'}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">EAN: {prod.barcode || 'S/EAN'}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      <div className="text-brand-300">{prod.units_per_package || 1}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-500 border-l border-slate-800/50 bg-slate-900/40">
                      {prod.default_commercial_unit || 'UN'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 font-mono bg-slate-900/40">
                      {formatCurrency(prod.last_package_price)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-500 border-l border-brand-900/20 bg-brand-900/5">
                      {prod.default_internal_unit || 'UN'}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400/80 font-mono bg-brand-900/5">
                      {formatCurrency(prod.average_internal_unit_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-outfit text-emerald-400 font-bold bg-brand-900/5">
                      {formatCurrency(prod.last_internal_unit_price)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <button
                            onClick={(e) => handleOpenEdit(prod, e)}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800"
                            title="Editar produto"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(prod.id, e)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800"
                            title="Excluir produto"
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
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-500 text-xs">
                    Nenhum produto cadastrado ainda. Envie uma nota fiscal para catalogar produtos automaticamente.
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
          <form onSubmit={handleSave} className="glass-panel border border-slate-800 rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-outfit uppercase tracking-wider">
                {editingProduct ? 'Editar Cadastro Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Nome Comercial do Produto</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Código Interno</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="Ex: INS-001"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">EAN (Código de Barras)</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="789..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Categoria</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Ex: Ingredientes"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Marca</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Unidade de Medida Comercial</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value.toUpperCase())}
                    maxLength={7}
                    placeholder="Ex: CX, FD, UN"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-brand-400 uppercase font-semibold">Unidade de Medida Interna</label>
                  <input
                    type="text"
                    value={formInternalUnit}
                    onChange={(e) => setFormInternalUnit(e.target.value.toUpperCase())}
                    maxLength={7}
                    placeholder="Ex: UN, KG"
                    className="w-full bg-slate-900 border border-brand-500/50 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-brand-400 uppercase font-semibold">Unidades por Embalagem</label>
                  <input
                    type="number"
                    value={formUpp}
                    onChange={(e) => setFormUpp(parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-full bg-slate-900 border border-brand-500/50 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                  {detectPackagingUnit(formUnit) && formUpp <= 1 && (
                    <p className="text-[10px] text-amber-300 font-semibold mt-1">
                      Informe quantas unidades existem dentro desta embalagem.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">NCM</label>
                  <input
                    type="text"
                    value={formNcm}
                    onChange={(e) => setFormNcm(e.target.value)}
                    placeholder="0000.00.00"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Último preço embalagem</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formLastPackagePrice}
                    onChange={(e) => setFormLastPackagePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-brand-400 uppercase font-semibold">Último preço unidade interna</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formLastInternalUnitPrice}
                    onChange={(e) => setFormLastInternalUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-brand-500/50 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Média preço embalagem</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAveragePackagePrice}
                    onChange={(e) => setFormAveragePackagePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-brand-400 uppercase font-semibold">Média preço unidade interna</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAverageInternalUnitPrice}
                    onChange={(e) => setFormAverageInternalUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-brand-500/50 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Menor preço interno</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formMinInternalUnitPrice}
                    onChange={(e) => setFormMinInternalUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Maior preço interno</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formMaxInternalUnitPrice}
                    onChange={(e) => setFormMaxInternalUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none transition-colors mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Anotações Internas</label>
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
