import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Calendar, User, FileText, Package, Users, X, Menu } from 'lucide-react';
import { db } from '../services/db';
import type { Customer, Product, Order } from '../services/db';
import { getActionableAlerts } from '../services/alerts';
import type { CommercialAlert } from '../services/alerts';
import { formatCurrency } from '../services/formatters';

interface TopbarProps {
  setCurrentTab: (tab: string) => void;
  onSelectCustomer: (id: string) => void;
  onSelectProduct: (id: string) => void;
  onSelectOrder: (id: string) => void;
  alerts: CommercialAlert[];
  onDismissAlert: (alertId: string) => void;
  onToggleMobileMenu?: () => void;
}

export function Topbar({ 
  setCurrentTab, 
  onSelectCustomer, 
  onSelectProduct, 
  onSelectOrder,
  alerts,
  onDismissAlert,
  onToggleMobileMenu
}: TopbarProps) {

  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    customers: Customer[];
    products: Product[];
    orders: Order[];
  }>({ customers: [], products: [], orders: [] });

  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Execute global search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults({ customers: [], products: [], orders: [] });
      return;
    }

    const query = searchQuery.toLowerCase();
    
    const allCustomers = db.getCustomers();
    const allProducts = db.getProducts();
    const allOrders = db.getOrders();

    const filteredCustomers = allCustomers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.document && c.document.replace(/\D/g, '').includes(query))
    ).slice(0, 4);

    const filteredProducts = allProducts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.code && p.code.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.includes(query))
    ).slice(0, 4);

    const filteredOrders = allOrders.filter(o => 
      (o.order_number && o.order_number.toLowerCase().includes(query)) || 
      (o.invoice_number && o.invoice_number.toLowerCase().includes(query)) ||
      (o.invoice_key && o.invoice_key.includes(query))
    ).slice(0, 4);

    setSearchResults({
      customers: filteredCustomers,
      products: filteredProducts,
      orders: filteredOrders
    });
  }, [searchQuery]);

  const handleResultClick = (type: 'customer' | 'product' | 'order', id: string) => {
    setSearchQuery('');
    setShowResults(false);
    
    if (type === 'customer') {
      onSelectCustomer(id);
      setCurrentTab('customers');
    } else if (type === 'product') {
      onSelectProduct(id);
      setCurrentTab('products');
    } else if (type === 'order') {
      onSelectOrder(id);
      setCurrentTab('orders');
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'price_increase': return '📈';
      case 'price_decrease': return '📉';
      case 'customer_inactive': return '💤';
      case 'new_product': return '✨';
      case 'new_customer': return '🆕';
      default: return '⚠️';
    }
  };

  const actionableAlerts = getActionableAlerts(alerts);
  const activeAlerts = actionableAlerts.slice(0, 5); // limit notification dropdown to 5 items

  return (
    <header className="min-h-16 border-b border-slate-800/60 glass-panel fixed top-0 right-0 left-0 md:left-64 z-10 px-3 sm:px-4 md:px-8 py-2 md:py-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 text-slate-300">
      
      {/* Global Search Bar */}
      <div ref={searchRef} className="relative w-full lg:w-96">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 border border-slate-800 hover:bg-slate-800/50 rounded-xl text-slate-300 shrink-0"
            title="Abrir menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Busca global (clientes, produtos, notas)..."
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-brand-500 rounded-full py-1.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          </div>
        </div>

        {/* Floating Search Results */}
        {showResults && searchQuery.trim().length >= 2 && (
          <div className="absolute top-12 left-0 w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-4 max-h-[400px] overflow-y-auto no-scrollbar z-50">
            {/* Customers */}
            {searchResults.customers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-500" />
                  Clientes
                </h4>
                <div className="space-y-1">
                  {searchResults.customers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleResultClick('customer', c.id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800/80 rounded-lg text-xs transition-colors flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-200 truncate pr-2">{c.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{c.document || 'S/D'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Products */}
            {searchResults.products.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-accent-cyan" />
                  Produtos
                </h4>
                <div className="space-y-1">
                  {searchResults.products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleResultClick('product', p.id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800/80 rounded-lg text-xs transition-colors flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-200 truncate pr-2">{p.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{p.code || 'S/C'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Orders */}
            {searchResults.orders.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-accent-emerald" />
                  Pedidos / Notas
                </h4>
                <div className="space-y-1">
                  {searchResults.orders.map(o => (
                    <button
                      key={o.id}
                      onClick={() => handleResultClick('order', o.id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800/80 rounded-lg text-xs transition-colors flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-200 truncate pr-2">Nota: {o.invoice_number || 'S/N'} ({o.order_number})</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatCurrency(o.total_amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state search */}
            {searchResults.customers.length === 0 && 
             searchResults.products.length === 0 && 
             searchResults.orders.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-500">
                Nenhum resultado encontrado para "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Topbar Right Side */}
      <div className="flex items-center justify-between lg:justify-end gap-2 sm:gap-4 lg:gap-6 w-full lg:w-auto">
        
        {/* Mock Time Indicator */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-medium text-slate-400 bg-slate-900/40 border border-slate-800/50 py-1.5 px-2.5 sm:px-3.5 rounded-full min-w-0">
          <Calendar className="w-3.5 h-3.5 text-brand-500" />
          <span className="truncate">Dados simulados até: <strong className="text-slate-200 font-semibold font-outfit">28 de Maio, 2026</strong></span>
        </div>

        {/* Notifications Alert Popover */}
        <div ref={notificationsRef} className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 border border-slate-800 hover:bg-slate-800/50 hover:text-slate-100 rounded-xl relative transition-all"
          >
            <Bell className="w-4 h-4" />
            {actionableAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {actionableAlerts.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-[calc(100vw-1.5rem)] max-w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 z-50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-200">Avisos críticos ({actionableAlerts.length})</span>
                <button 
                  onClick={() => {
                    setCurrentTab('alerts');
                    setShowNotifications(false);
                  }}
                  className="text-[10px] font-semibold text-brand-400 hover:text-brand-300"
                >
                  Ver todos
                </button>
              </div>

              {activeAlerts.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                  {activeAlerts.map(alert => (
                    <div 
                      key={alert.id} 
                      onClick={() => {
                        onDismissAlert(alert.id);
                        setShowNotifications(false);
                        setCurrentTab('alerts');
                      }}
                      className="p-2 bg-slate-950/40 border border-slate-800 hover:bg-slate-800/40 rounded-xl text-xs space-y-1 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-slate-200">
                        <span>{getAlertIcon(alert.type)}</span>
                        <span className="truncate">{alert.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">{alert.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">
                  Nenhum aviso crítico agora. Outros avisos ficam só na central.
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800/80">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center text-white font-bold font-outfit text-sm shadow-md shadow-brand-500/10">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-semibold text-slate-200 font-outfit leading-none">PrecoMap</div>
            <span className="text-[10px] text-slate-500 leading-none">Operações Internas</span>
          </div>
        </div>

      </div>
    </header>
  );
}
