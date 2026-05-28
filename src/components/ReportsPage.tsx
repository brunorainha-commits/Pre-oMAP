import { useState, useEffect } from 'react';
import {
  BarChart3, 
  FileSpreadsheet, 
  Printer, 
  ArrowUpRight, 
  ArrowDownRight,
  Calendar,
  Filter
} from 'lucide-react';
import { db } from '../services/db';
import { formatCurrency, parseFormattedCurrency } from '../services/formatters';

type ReportType = 
  | 'revenue_by_customer'
  | 'volume_by_product'
  | 'price_inflation'
  | 'price_deflation'
  | 'inactive_customers'
  | 'ticket_by_customer'
  | 'revenue_by_product';

interface ReportRow {
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  col5: string;
}

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue_by_customer');
  const [reportData, setReportData] = useState<{
    title: string;
    headers: string[];
    rows: ReportRow[];
  }>({ title: '', headers: [], rows: [] });

  useEffect(() => {
    generateReport();
  }, [selectedReport]);

  const generateReport = () => {
    const customers = db.getCustomers();
    const products = db.getProducts();
    const orderItems = db.getOrderItems();
    const priceHistory = db.getPriceHistory();
    const currentDate = new Date('2026-05-28');

    let title = '';
    let headers: string[] = [];
    let rows: ReportRow[] = [];

    switch (selectedReport) {
      case 'revenue_by_customer':
        title = 'Relatório de Compras por Cliente';
        headers = ['Razão Social', 'CNPJ/CPF', 'Qtd Pedidos', 'Última Compra', 'Total Acumulado'];
        rows = customers
          .map(c => ({
            col1: c.name,
            col2: c.document || 'S/D',
            col3: String(c.total_orders),
            col4: c.last_purchase_date || 'n/a',
            col5: formatCurrency(c.total_amount)
          }))
          .sort((a, b) => {
            const valA = parseFormattedCurrency(a.col5);
            const valB = parseFormattedCurrency(b.col5);
            return valB - valA;
          });
        break;

      case 'revenue_by_product':
        title = 'Ranking de Produtos por Faturamento';
        headers = ['Produto', 'Código', 'Qtd Vendida', 'Preço Médio', 'Faturamento Total'];
        
        // Group items by product
        const prodRevMap: Record<string, { name: string; code: string; qty: number; amt: number }> = {};
        orderItems.forEach(it => {
          if (!prodRevMap[it.product_id]) {
            prodRevMap[it.product_id] = { name: it.description, code: it.product_code || 'S/C', qty: 0, amt: 0 };
          }
          prodRevMap[it.product_id].qty += it.internal_quantity;
          prodRevMap[it.product_id].amt += it.commercial_total_price;
        });

        rows = Object.values(prodRevMap)
          .map(item => ({
            col1: item.name,
            col2: item.code,
            col3: String(item.qty),
            col4: formatCurrency(item.amt / item.qty),
            col5: formatCurrency(item.amt)
          }))
          .sort((a, b) => {
            const valA = parseFormattedCurrency(a.col5);
            const valB = parseFormattedCurrency(b.col5);
            return valB - valA;
          });
        break;

      case 'volume_by_product':
        title = 'Volume de Compras por Produto';
        headers = ['Nome do Produto', 'Código', 'Unidade', 'Quantidade Total', 'Última Compra'];
        
        const prodVolMap: Record<string, { name: string; code: string; unit: string; qty: number; lastDate: string }> = {};
        orderItems.forEach(it => {
          const phs = db.getPriceHistoryByProduct(it.product_id);
          const lastD = phs.length > 0 ? phs[phs.length - 1].date : '';
          
          if (!prodVolMap[it.product_id]) {
            prodVolMap[it.product_id] = { 
              name: it.description, 
              code: it.product_code || 'S/C', 
              unit: it.commercial_unit || 'UN', 
              qty: 0,
              lastDate: lastD
            };
          }
          prodVolMap[it.product_id].qty += it.internal_quantity;
        });

        rows = Object.values(prodVolMap)
          .map(item => ({
            col1: item.name,
            col2: item.code,
            col3: item.unit,
            col4: String(item.qty),
            col5: item.lastDate
          }))
          .sort((a, b) => parseFloat(b.col4) - parseFloat(a.col4));
        break;

      case 'price_inflation':
        title = 'Produtos com Maior Aumento de Preço';
        headers = ['Produto', 'Código', 'Preço Anterior', 'Preço Atual', 'Variação %'];
        
        rows = products.map(prod => {
          const phs = priceHistory
            .filter(ph => ph.product_id === prod.id)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          if (phs.length < 2) return null;
          const latest = phs[phs.length - 1].internal_unit_price;
          const prev = phs[phs.length - 2].internal_unit_price;
          const pct = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
          
          if (pct <= 0) return null;

          return {
            col1: prod.name,
            col2: prod.code || 'S/C',
            col3: formatCurrency(prev),
            col4: formatCurrency(latest),
            col5: `+${pct.toFixed(1)}%`
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const pctA = parseFloat(a!.col5.replace('+', '').replace('%', ''));
          const pctB = parseFloat(b!.col5.replace('+', '').replace('%', ''));
          return pctB - pctA;
        }) as ReportRow[];
        break;

      case 'price_deflation':
        title = 'Produtos com Maior Queda de Preço';
        headers = ['Produto', 'Código', 'Preço Anterior', 'Preço Atual', 'Variação %'];

        rows = products.map(prod => {
          const phs = priceHistory
            .filter(ph => ph.product_id === prod.id)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          if (phs.length < 2) return null;
          const latest = phs[phs.length - 1].internal_unit_price;
          const prev = phs[phs.length - 2].internal_unit_price;
          const pct = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
          
          if (pct >= 0) return null;

          return {
            col1: prod.name,
            col2: prod.code || 'S/C',
            col3: formatCurrency(prev),
            col4: formatCurrency(latest),
            col5: `${pct.toFixed(1)}%`
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const pctA = parseFloat(a!.col5.replace('%', ''));
          const pctB = parseFloat(b!.col5.replace('%', ''));
          return pctA - pctB; // descending absolute fall
        }) as ReportRow[];
        break;

      case 'inactive_customers':
        title = 'Relatório de Clientes Inativos';
        headers = ['Cliente', 'CNPJ/CPF', 'Última Compra', 'Dias Inativo', 'Total Comprado'];
        
        rows = customers.map(c => {
          if (!c.last_purchase_date) return null;
          const lastD = new Date(c.last_purchase_date);
          const diff = Math.abs(currentDate.getTime() - lastD.getTime());
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          
          if (days < 30) return null; // not inactive

          return {
            col1: c.name,
            col2: c.document || 'S/D',
            col3: c.last_purchase_date,
            col4: `${days} dias`,
            col5: formatCurrency(c.total_amount)
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const daysA = parseInt(a!.col4.replace(' dias', ''));
          const daysB = parseInt(b!.col4.replace(' dias', ''));
          return daysB - daysA;
        }) as ReportRow[];
        break;

      case 'ticket_by_customer':
        title = 'Ticket Médio e Frequência de Clientes';
        headers = ['Cliente', 'Volume Compras', 'Nº Notas', 'Frequência Média', 'Ticket Médio'];
        
        rows = customers.map(c => {
          if (!c.last_purchase_date) return null;
          const lastD = new Date(c.last_purchase_date);
          const diff = Math.abs(currentDate.getTime() - lastD.getTime());
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          const freq = c.total_orders > 1 ? Math.round(days / c.total_orders) : 0;
          const ticket = c.total_orders > 0 ? c.total_amount / c.total_orders : 0;

          return {
            col1: c.name,
            col2: formatCurrency(c.total_amount),
            col3: String(c.total_orders),
            col4: freq > 0 ? `${freq} dias` : 'N/A',
            col5: formatCurrency(ticket)
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const ticketA = parseFormattedCurrency(a!.col5);
          const ticketB = parseFormattedCurrency(b!.col5);
          return ticketB - ticketA;
        }) as ReportRow[];
        break;
    }

    setReportData({ title, headers, rows });
  };

  // Export CSV / Excel
  const handleExportCSV = () => {
    if (reportData.rows.length === 0) return;

    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Portuguese compatibility
    csvContent += reportData.headers.join(';') + '\n';
    
    reportData.rows.forEach(r => {
      const row = [r.col1, r.col2, r.col3, r.col4, r.col5].map(v => `"${v}"`);
      csvContent += row.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedReport}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print trigger
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Relatórios Comerciais</h2>
          <p className="text-sm text-slate-400 mt-1">Gere planilhas comerciais, analise flutuações e exporte para CSV/Excel ou use a impressão do navegador.</p>
        </div>
      </div>

      {/* Select Report filter */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between print:hidden">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
            <Filter className="w-4 h-4" />
          </div>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value as ReportType)}
            className="bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none transition-colors w-full md:w-72 font-medium"
          >
            <option value="revenue_by_customer">Faturamento Total por Cliente</option>
            <option value="revenue_by_product">Faturamento Total por Produto</option>
            <option value="volume_by_product">Volume Total de Produtos</option>
            <option value="price_inflation">Produtos com Maior Aumento de Preço</option>
            <option value="price_deflation">Produtos com Maior Queda de Preço</option>
            <option value="inactive_customers">Clientes Inativos (30+ dias)</option>
            <option value="ticket_by_customer">Ticket Médio por Cliente</option>
          </select>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Planilha Excel / CSV</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/10 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Report Sheet Layout */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl p-6 bg-slate-900/10 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Document Header (For print design formatting) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6 print:border-slate-300">
          <div>
            <h1 className="text-base font-bold font-outfit text-white tracking-wide print:text-black print:text-lg">{reportData.title}</h1>
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5 print:text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Emitido em: {new Date().toLocaleDateString('pt-BR')} • PrecoMap
            </span>
          </div>
          <div className="bg-gradient-to-tr from-brand-600 to-accent-cyan p-2.5 rounded-xl text-white print:hidden">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase font-bold bg-slate-900/30 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <th className="py-2.5 px-4">{reportData.headers[0]}</th>
                <th className="py-2.5 px-4">{reportData.headers[1]}</th>
                <th className="py-2.5 px-4 text-center">{reportData.headers[2]}</th>
                <th className="py-2.5 px-4 text-center">{reportData.headers[3]}</th>
                <th className="py-2.5 px-4 text-right">{reportData.headers[4]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/20 print:divide-slate-200">
              {reportData.rows.map((row, idx) => {
                const isInflation = row.col5.startsWith('+');
                const isDeflation = row.col5.startsWith('-');
                return (
                  <tr key={idx} className="hover:bg-slate-900/10 print:hover:bg-transparent">
                    <td className="py-3 px-4 font-semibold text-slate-200 print:text-black">{row.col1}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono print:text-slate-700">{row.col2}</td>
                    <td className="py-3 px-4 text-center text-slate-300 print:text-slate-700 font-mono">{row.col3}</td>
                    <td className="py-3 px-4 text-center text-slate-400 print:text-slate-700 font-mono">{row.col4}</td>
                    <td className={`py-3 px-4 text-right font-outfit font-bold print:text-black ${
                      isInflation ? 'text-rose-400' : isDeflation ? 'text-emerald-400' : 'text-white'
                    }`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {isInflation && <ArrowUpRight className="w-3.5 h-3.5 shrink-0 print:hidden" />}
                        {isDeflation && <ArrowDownRight className="w-3.5 h-3.5 shrink-0 print:hidden" />}
                        <span>{row.col5}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {reportData.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 text-xs">
                    Sem registros para gerar este relatório.
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
