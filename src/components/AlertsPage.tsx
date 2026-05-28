import { useEffect } from 'react';
import { 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  UserX, 
  PackagePlus, 
  UserPlus, 
  AlertOctagon, 
  Copy,
  ArrowRight,
  X
} from 'lucide-react';
import type { CommercialAlert } from '../services/alerts';

interface AlertsPageProps {
  setCurrentTab: (tab: string) => void;
  onSelectCustomer: (id: string) => void;
  onSelectProduct: (id: string) => void;
  onSelectOrder: (id: string) => void;
  alerts: CommercialAlert[];
  onRefreshAlerts: () => void;
  onDismissAlert: (alertId: string) => void;
  onDismissAlerts: (alertIds: string[]) => void;
}

export function AlertsPage({ 
  setCurrentTab, 
  onSelectCustomer, 
  onSelectProduct, 
  onSelectOrder,
  alerts,
  onRefreshAlerts,
  onDismissAlert,
  onDismissAlerts
}: AlertsPageProps) {

  useEffect(() => {
    onRefreshAlerts();
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'price_increase':
        return <TrendingUp className="w-5 h-5 text-rose-400" />;
      case 'price_decrease':
        return <TrendingDown className="w-5 h-5 text-emerald-400" />;
      case 'customer_inactive':
        return <UserX className="w-5 h-5 text-rose-400" />;
      case 'new_product':
        return <PackagePlus className="w-5 h-5 text-cyan-400" />;
      case 'new_customer':
        return <UserPlus className="w-5 h-5 text-brand-400" />;
      case 'duplicate_customer':
      case 'duplicate_product':
        return <Copy className="w-5 h-5 text-amber-400" />;
      case 'anomalous_order':
        return <AlertOctagon className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const handleAlertClick = (alert: CommercialAlert) => {
    const id = alert.target_id;
    onDismissAlert(alert.id);
    if (alert.type === 'price_increase' || alert.type === 'price_decrease' || alert.type === 'new_product' || alert.type === 'duplicate_product') {
      onSelectProduct(id);
      setCurrentTab('products');
    } else if (alert.type === 'customer_inactive' || alert.type === 'new_customer' || alert.type === 'duplicate_customer') {
      onSelectCustomer(id);
      setCurrentTab('customers');
    } else if (alert.type === 'anomalous_order') {
      onSelectOrder(id);
      setCurrentTab('orders');
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-l-4 border-l-rose-500 bg-rose-500/5';
      case 'medium':
        return 'border-l-4 border-l-amber-500 bg-amber-500/5';
      case 'low':
      default:
        return 'border-l-4 border-l-slate-700 bg-slate-900/35';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high':
        return <span className="px-2 py-0.5 text-[8px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Urgente</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[8px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Atenção</span>;
      case 'low':
      default:
        return <span className="px-2 py-0.5 text-[8px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700">Informativo</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Central de Alertas Inteligentes</h2>
          <p className="text-sm text-slate-400 mt-1">Notificações geradas automaticamente com base no histórico de faturamentos, preços e clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={() => onDismissAlerts(alerts.map(alert => alert.id))}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 border border-slate-800 hover:bg-slate-800/60 rounded-xl transition-all"
            >
              Limpar avisos
            </button>
          )}
          <button
            onClick={onRefreshAlerts}
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 px-3 py-1.5 border border-slate-850 hover:bg-slate-800/40 rounded-xl transition-all"
          >
            Atualizar Feed
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => handleAlertClick(alert)}
              className={`p-4 rounded-2xl border border-slate-800/80 hover:border-slate-750 flex items-start justify-between gap-4 cursor-pointer transition-all duration-200 hover:translate-x-1 shadow-md ${getSeverityStyle(alert.severity)}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 bg-slate-950/60 rounded-xl shrink-0 mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-100 font-outfit">{alert.title}</h4>
                    {getSeverityLabel(alert.severity)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{alert.description}</p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 mt-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDismissAlert(alert.id);
                  }}
                  className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Dispensar aviso"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold">
                  <span>Analisar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 text-xs">
            Nenhum alerta pendente no momento. Bom trabalho!
          </div>
        )}
      </div>
    </div>
  );
}
