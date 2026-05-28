import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud, File, AlertCircle, CheckCircle,
  Eye, AlertTriangle, FileX, ArrowRight
} from 'lucide-react';
import { parseXmlInvoice } from '../services/parseXml';
import { normalizeInvoiceData } from '../services/normalizer';
import { db } from '../services/db';
import type { NormalizedInvoice } from '../services/db';

interface UploadPageProps {
  userRole: string;
  onReviewInvoice: (invoice: NormalizedInvoice) => void;
}

type FileQueueStatus =
  | 'pending'
  | 'processing'
  | 'review'
  | 'completed'
  | 'error';

interface UploadFileState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'xml';
  status: FileQueueStatus;
  progress: number;
  errorMessage: string | null;
  extractedData: NormalizedInvoice | null;
}

export function UploadPage({ userRole, onReviewInvoice }: UploadPageProps) {
  const [fileList, setFileList] = useState<UploadFileState[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [duplicateCheck, setDuplicateCheck] = useState<{
    fileId: string;
    extractedData: NormalizedInvoice;
    duplicateOrder: any;
  } | null>(null);

  const canEdit = userRole === 'admin' || userRole === 'operator';

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadFileState>) => {
      setFileList(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    },
    []
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    if (!canEdit) {
      alert('Apenas administradores e operadores podem fazer upload e processar notas fiscais.');
      return;
    }

    const newFiles: UploadFileState[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xml') {
        alert(`Formato não permitido. Envie apenas arquivos XML de nota fiscal.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`"${file.name}" excede 5 MB.`);
        continue;
      }
      const entry: UploadFileState = {
        id: `file-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: 'xml',
        status: 'pending',
        progress: 0,
        errorMessage: null,
        extractedData: null
      };
      newFiles.push(entry);
      triggerExtraction(entry);
    }
    setFileList(prev => [...prev, ...newFiles]);
  };

  const triggerExtraction = async (entry: UploadFileState) => {
    try {
      updateFile(entry.id, { status: 'processing', progress: 50 });
      const text = await entry.file.text();
      const parsed = parseXmlInvoice(text, entry.name);
      const normalized = normalizeInvoiceData(parsed, 'xml', entry.name);
      updateFile(entry.id, {
        status: 'review',
        progress: 100,
        extractedData: normalized
      });
    } catch (err: any) {
      updateFile(entry.id, {
        status: 'error',
        errorMessage: err.message || 'Falha ao ler XML.',
        progress: 0
      });
    }
  };

  const handleReviewClick = (fileId: string, data: NormalizedInvoice) => {
    const orders    = db.getOrders();
    const customers = db.getCustomers();
    const existing  = customers.find(c =>
      (data.customer_document && c.document?.replace(/\D/g, '') === data.customer_document.replace(/\D/g, '')) ||
      c.name.toLowerCase() === data.customer_name.toLowerCase()
    );
    let dup: any = null;
    if (data.invoice_key) dup = orders.find(o => o.invoice_key === data.invoice_key);
    if (!dup && existing && data.invoice_number && data.issue_date) {
      dup = orders.find(o =>
        o.invoice_number === data.invoice_number &&
        o.customer_id === existing.id &&
        o.issue_date === data.issue_date
      );
    }
    if (dup) setDuplicateCheck({ fileId, extractedData: data, duplicateOrder: dup });
    else onReviewInvoice(data);
  };

  const clearFile = (id: string) => setFileList(prev => prev.filter(f => f.id !== id));

  const getStatusBadge = (f: UploadFileState) => {
    const cls = 'text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1';
    switch (f.status) {
      case 'pending': return <span className={`${cls} bg-slate-800 text-slate-400`}>Pendente</span>;
      case 'processing': return <span className={`${cls} bg-indigo-500/10 text-indigo-400 border border-indigo-500/20`}>Processando</span>;
      case 'review': return <span className={`${cls} bg-amber-500/10 text-amber-400 border border-amber-500/20`}><Eye className="w-3 h-3" />Revisar</span>;
      case 'completed': return <span className={`${cls} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}><CheckCircle className="w-3 h-3" />Salvo</span>;
      case 'error': return <span className={`${cls} bg-rose-500/10 text-rose-400 border border-rose-500/20`}><AlertCircle className="w-3 h-3" />Falha</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white tracking-wide">Importar Pedidos</h1>
          <p className="text-slate-400 mt-1">Faça o upload do XML da Nota Fiscal Eletrônica (NF-e)</p>
        </div>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`glass-panel border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 group
          ${isDragActive ? 'border-brand-500 bg-brand-500/5 scale-[1.02]' : 'border-slate-700/50 hover:border-brand-500/50 hover:bg-slate-800/30'}
          ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => canEdit && fileInputRef.current?.click()}
      >
        <div className="w-20 h-20 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:bg-brand-500/20">
          <UploadCloud className="w-10 h-10 text-brand-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          {isDragActive ? 'Solte o arquivo aqui' : 'Arraste e solte o XML da nota'}
        </h3>
        <p className="text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
          Arraste o arquivo .xml para esta área ou clique para selecionar do seu computador.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml"
          className="hidden"
          onChange={handleFileChange}
          disabled={!canEdit}
        />

        <button disabled={!canEdit} className="btn btn-primary shadow-lg shadow-brand-500/20 px-8 py-3 rounded-xl text-sm font-semibold hover:-translate-y-0.5 transition-all">
          Selecionar Arquivos XML
        </button>
      </div>

      {fileList.length > 0 && (
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-bold text-white">Arquivos Processados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fileList.map((file) => (
              <div key={file.id} className="glass-panel rounded-2xl p-4 flex flex-col transition-all hover:bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                      <File className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-white truncate" title={file.name}>{file.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button onClick={() => clearFile(file.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-1" title="Remover">
                    <FileX className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-auto pt-3 border-t border-slate-800/50">
                  <div className="flex items-center justify-between">
                    {getStatusBadge(file)}
                    {file.status === 'review' && file.extractedData && (
                      <button onClick={() => handleReviewClick(file.id, file.extractedData!)} className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1">
                        Revisar Dados <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {file.status === 'error' && (
                    <p className="text-xs text-rose-400 mt-2 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">{file.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {duplicateCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center mb-4 border border-rose-500/20">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Nota Fiscal já Importada</h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              O sistema detectou que esta nota (Nº <strong className="text-white">{duplicateCheck.extractedData.invoice_number}</strong>) 
              do fornecedor <strong className="text-white">{duplicateCheck.extractedData.customer_name}</strong> já foi 
              salva na base de dados no dia {duplicateCheck.duplicateOrder.created_at?.split('T')[0]}.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDuplicateCheck(null)} className="btn bg-slate-800 hover:bg-slate-700 text-white flex-1 py-2.5">
                Cancelar Importação
              </button>
              <button onClick={() => {
                const data = duplicateCheck.extractedData;
                setDuplicateCheck(null);
                onReviewInvoice(data);
              }} className="btn bg-rose-500 hover:bg-rose-600 text-white flex-1 py-2.5">
                Importar Novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
