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
import { generateAlerts } from './services/alerts';
import type { CommercialAlert } from './services/alerts';


function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  
  // Selection states (for drill down navigation)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Active invoice being reviewed (takes over screen if active)
  const [activeReviewInvoice, setActiveReviewInvoice] = useState<NormalizedInvoice | null>(null);

  // Alerts feed state
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);

  // Load configuration on mount
  useEffect(() => {
    setUserRole(db.getUserRole());
    refreshAlerts();
  }, []);

  const refreshAlerts = () => {
    setAlerts(generateAlerts());
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
      // 1. Save upload entry
      db.saveUpload({
        id: `upl-${finalInvoice.id}`,
        file_name: finalInvoice.source_file_name,
        file_type: finalInvoice.source_file_type,
        status: 'completed',
        error_message: null,
        extracted_data: finalInvoice,
        created_at: new Date().toISOString()
      });

      // 2. Import elements
      const newOrder = db.importInvoice(finalInvoice);

      // 3. Clear review and navigate
      setActiveReviewInvoice(null);
      refreshAlerts();
      setSelectedOrderId(newOrder.id);
      setCurrentTab('orders');
      
      alert(`Nota fiscal/Pedido importado com sucesso!`);
    } catch (e: any) {
      alert(`Erro ao salvar pedido: ${e.message || e}`);
    }
  };

  const handleCancelReview = () => {
    if (confirm("Deseja cancelar a revisão? Todos os dados extraídos desta nota serão descartados.")) {
      setActiveReviewInvoice(null);
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
            onReviewInvoice={(inv) => setActiveReviewInvoice(inv)}
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
          alertsCount={alerts.length}
          onWipeDB={handleWipeDatabase}
        />
      </div>

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col pl-64 min-w-0 print:pl-0">
        
        {/* Topbar navigation & global search */}
        <div className="print:hidden">
          <Topbar 
            setCurrentTab={setCurrentTab}
            onSelectCustomer={setSelectedCustomerId}
            onSelectProduct={setSelectedProductId}
            onSelectOrder={setSelectedOrderId}
            alerts={alerts}
          />
        </div>

        {/* Content Wrapper */}
        <main className="flex-grow pt-24 px-8 pb-12 print:pt-4 print:px-4">
          {activeReviewInvoice ? (
            <ReviewPage 
              invoice={activeReviewInvoice}
              onSave={handleSaveReviewedInvoice}
              onCancel={handleCancelReview}
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
