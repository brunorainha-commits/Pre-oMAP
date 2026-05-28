// Sidebar.tsx
import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Users, 
  Package, 
  FileText, 
  TrendingUp, 
  BarChart3, 
  Bell, 
  RotateCcw,
  Shield,
  Activity
} from 'lucide-react';
import type { UserRole } from '../services/db';


interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  alertsCount: number;
  onResetDB: () => void;
}

export function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  userRole, 
  setUserRole,
  alertsCount,
  onResetDB
}: SidebarProps) {

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload de Notas', icon: UploadCloud },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'products', label: 'Produtos', icon: Package },
    { id: 'orders', label: 'Pedidos', icon: FileText },
    { id: 'prices', label: 'Histórico de Preços', icon: TrendingUp },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'alerts', label: 'Alertas Inteligentes', icon: Bell, badge: alertsCount }
  ];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as UserRole;
    setUserRole(newRole);
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'operator': return 'Operador';
      case 'viewer': return 'Visualizador';
    }
  };

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-20 text-slate-300">
      {/* Brand Logo */}
      <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
        <div className="bg-gradient-to-tr from-brand-600 to-accent-cyan p-2.5 rounded-xl shadow-lg shadow-brand-500/20">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-outfit font-bold text-lg text-white leading-none tracking-wide">PriceOrder</h1>
          <span className="text-xs font-medium text-accent-cyan tracking-wider font-outfit uppercase">Hub</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium ${
                isActive 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/15 font-semibold' 
                  : 'hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-100'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  isActive ? 'bg-white text-brand-700' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Simulator Control Panel */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/30">
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase font-outfit">
            <Shield className="w-3.5 h-3.5 text-brand-500" />
            <span>Perfil de Acesso</span>
          </div>
          
          <select
            value={userRole}
            onChange={handleRoleChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors"
          >
            <option value="admin">Administrador (Total)</option>
            <option value="operator">Operador (Edição)</option>
            <option value="viewer">Visualizador (Leitura)</option>
          </select>

          <div className="text-[10px] text-slate-500 leading-normal">
            Permissões ativas: <span className="font-semibold text-accent-cyan">{getRoleLabel(userRole)}</span>.
          </div>
        </div>

        {/* Developer Actions */}
        <button
          onClick={onResetDB}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-800 hover:bg-slate-800/50 hover:border-slate-700 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Resetar Base (Dados Mock)</span>
        </button>
      </div>
    </aside>
  );
}
