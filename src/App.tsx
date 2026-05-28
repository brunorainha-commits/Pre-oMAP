// App.tsx
import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './components/Dashboard';
import { UploadPage } from './components/UploadPage';
import { ReviewPage } from './components/ReviewPage';
import { CustomersPage } from './components/CustomersPage';
import { ProductsPage } from './components/ProductsPage';
import { OrdersPage } from './components/OrdersPage';
import { PriceHistoryPage } from './components/PriceHistoryPage';
import { ReportsPage } from './components/ReportsPage';
import { AlertsPage } from './components/AlertsPage';

import { db } from './services/db';
import type { UserRole, NormalizedInvoice } from './services/db';
import { dismissAlert, dismissAlerts, generateAlerts, getActionableAlerts } from './services/alerts';
import type { CommercialAlert } from './services/alerts';


function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Selection states (for drill down navigation)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Active invoice being reviewed (takes over screen if active)
  const [activeReviewInvoice, setActiveReviewInvoice] = useState<NormalizedInvoice | null>(null);
  const [reviewQueue, setReviewQueue] = useState<NormalizedInvoice[]>([]);

  // Alerts feed state
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);
  const actionableAlertsCount = getActionableAlerts(alerts).length;

  const getInvoiceReviewKey = (invoice: NormalizedInvoice) => {
    return invoice.invoice_key ||
      `${invoice.source_file_name}|${invoice.invoice_number || ''}|${invoice.customer_document || ''}|${invoice.total_amount}|${invoice.items.length}`;
  };

  // Load configuration on mount
  useEffect(() => {
    setUserRole(db.getUserRole());
    refreshAlerts();
  }, []);

  const refreshAlerts = () => {
    setAlerts(generateAlerts());
  };

  const handleDismissAlert = (alertId: string) => {
    dismissAlert(alertId);
    refreshAlerts();
  };

  const handleDismissAlerts = (alertIds: string[]) => {
    dismissAlerts(alertIds);
    refreshAlerts();
  };

  const startSingleReview = (invoice: NormalizedInvoice) => {
    setReviewQueue([]);
    setActiveReviewInvoice(invoice);
    setIsMobileMenuOpen(false);
  };

  const startBatchReview = (invoices: NormalizedInvoice[]) => {
    const seen = new Set<string>();
    const readyInvoices = invoices.filter(invoice => {
      if (!invoice) return false;
      const key = getInvoiceReviewKey(invoice);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (readyInvoices.length === 0) return;
    setReviewQueue(readyInvoices.slice(1));
    setActiveReviewInvoice(readyInvoices[0]);
    setIsMobileMenuOpen(false);
  };

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    db.setUserRole(role);
  };



  // Wipe database callback
  const handleWipeDatabase = () => {
    if (confirm("ATENÇÃO: Deseja apagar todos os dados permanentemente? O aplicativo ficará zerado, pronto para cadastrar dados reais de produção.")) {
      db.wipeDatabase();
      setSelectedCustomerId(null);
      setSelectedProductId(null);
      setSelectedOrderId(null);
      setActiveReviewInvoice(null);
      setCurrentTab('dashboard');
      refreshAlerts();
      alert("Banco de dados completamente limpo e pronto para produção.");
    }
  };

  // Review & Save callbacks
  const handleSaveReviewedInvoice = (finalInvoice: NormalizedInvoice) => {
    try {
      // 1. Import elements
      const newOrder = db.importInvoice(finalInvoice);

      // 2. Save upload entry only after the import succeeds
      db.saveUpload({
        id: `upl-${finalInvoice.id}`,
        file_name: finalInvoice.source_file_name,
        file_type: finalInvoice.source_file_type,
        status: 'completed',
        error_message: null,
        extracted_data: finalInvoice,
        created_at: new Date().toISOString()
      });

      // 3. Continue queued XML reviews or finish
      refreshAlerts();
      const [nextInvoice, ...remainingQueue] = reviewQueue;
      if (nextInvoice) {
        setReviewQueue(remainingQueue);
        setActiveReviewInvoice(nextInvoice);
        return;
      }

      setActiveReviewInvoice(null);
      setReviewQueue([]);
      setSelectedOrderId(newOrder.id);
      setCurrentTab('orders');
      
      alert(`Nota fiscal/Pedido importado com sucesso!`);
    } catch (e: any) {
      alert(`Erro ao salvar pedido: ${e.message || e}`);
    }
  };

  const handleCancelReview = () => {
    const queueMessage = reviewQueue.length > 0 ? ` e mais ${reviewQueue.length} XML(s) na fila` : '';
    if (confirm(`Deseja cancelar a revisão desta nota${queueMessage}? Os dados extraídos serão descartados da fila de revisão.`)) {
      setActiveReviewInvoice(null);
      setReviewQueue([]);
    }
  };

  // Switcher to render active page
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard 
            setCurrentTab={setCurrentTab}
            onSelectCustomer={setSelectedCustomerId}
            onSelectProduct={setSelectedProductId}
            onSelectOrder={setSelectedOrderId}
            alerts={alerts}
          />
        );
      case 'upload':
        return (
          <UploadPage 
            userRole={userRole}
            onReviewInvoice={startSingleReview}
            onReviewInvoices={startBatchReview}
          />
        );
      case 'customers':
        return (
          <CustomersPage 
            userRole={userRole}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        );
      case 'products':
        return (
          <ProductsPage 
            userRole={userRole}
            selectedProductId={selectedProductId}
            setSelectedProductId={setSelectedProductId}
          />
        );
      case 'orders':
        return (
          <OrdersPage 
            userRole={userRole}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
          />
        );
      case 'prices':
        return <PriceHistoryPage />;
      case 'reports':
        return <ReportsPage />;
      case 'alerts':
        return (
          <AlertsPage 
            setCurrentTab={setCurrentTab}
            onSelectCustomer={setSelectedCustomerId}
            onSelectProduct={setSelectedProductId}
            onSelectOrder={setSelectedOrderId}
            alerts={alerts}
            onRefreshAlerts={refreshAlerts}
            onDismissAlert={handleDismissAlert}
            onDismissAlerts={handleDismissAlerts}
          />
        );

      default:
        return <div className="text-center py-20">Página em desenvolvimento.</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-slate-100">
      
      {/* Sidebar Navigation */}
      <div className="print:hidden">
        <Sidebar 
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          userRole={userRole}
          setUserRole={handleRoleChange}
          alertsCount={actionableAlertsCount}
          onWipeDB={handleWipeDatabase}
          isMobileOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        {isMobileMenuOpen && (
          <button
            className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar menu"
          />
        )}
      </div>

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 print:pl-0">
        
        {/* Topbar navigation & global search */}
        <div className="print:hidden">
          <Topbar 
            setCurrentTab={setCurrentTab}
            onSelectCustomer={setSelectedCustomerId}
            onSelectProduct={setSelectedProductId}
            onSelectOrder={setSelectedOrderId}
            alerts={alerts}
            onDismissAlert={handleDismissAlert}
            onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          />
        </div>

        {/* Content Wrapper */}
        <main className="flex-grow pt-32 lg:pt-24 px-3 sm:px-4 md:px-8 pb-12 print:pt-4 print:px-4 min-w-0">
          {activeReviewInvoice ? (
            <ReviewPage 
              key={getInvoiceReviewKey(activeReviewInvoice)}
              invoice={activeReviewInvoice}
              onSave={handleSaveReviewedInvoice}
              onCancel={handleCancelReview}
              reviewQueueCount={reviewQueue.length}
            />
          ) : (
            renderTabContent()
          )}
        </main>
      </div>

    </div>
  );
}

export default App;
