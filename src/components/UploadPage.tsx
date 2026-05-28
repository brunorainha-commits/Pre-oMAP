// UploadPage.tsx
import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import { parseXmlInvoice } from '../services/parseXml';
import { parsePdfInvoice } from '../services/parsePdf';
import { normalizeInvoiceData } from '../services/normalizer';
import type { NormalizedInvoice } from '../services/db';

interface UploadPageProps {
  userRole: string;
  onReviewInvoice: (invoice: NormalizedInvoice) => void;
}


interface UploadFileState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'xml' | 'pdf';
  status: 'pending' | 'processing' | 'extracting' | 'review' | 'completed' | 'error';
  progress: number;
  errorMessage: string | null;
  extractedData: NormalizedInvoice | null;
}

export function UploadPage({ userRole, onReviewInvoice }: UploadPageProps) {
  const [fileList, setFileList] = useState<UploadFileState[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = userRole === 'admin' || userRole === 'operator';

  // Handle Drag Over/Enter/Leave
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  // Process selected files
  const processFiles = (files: FileList | null) => {
    if (!files) return;
    if (!canEdit) {
      alert("Apenas administradores e operadores podem fazer upload e processar notas fiscais.");
      return;
    }

    const newFiles: UploadFileState[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      // Validation: file types
      if (extension !== 'xml' && extension !== 'pdf') {
        alert(`O arquivo "${file.name}" possui formato inválido. Aceitamos apenas .xml e .pdf.`);
        continue;
      }

      // Validation: file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(`O arquivo "${file.name}" excede o tamanho máximo de 5MB.`);
        continue;
      }

      const fileState: UploadFileState = {
        id: `file-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: extension as 'xml' | 'pdf',
        status: 'pending',
        progress: 0,
        errorMessage: null,
        extractedData: null
      };
      
      newFiles.push(fileState);
      
      // Start processing this file asynchronously
      triggerExtraction(fileState);
    }

    setFileList(prev => [...prev, ...newFiles]);
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const triggerClick = () => {
    fileInputRef.current?.click();
  };

  // Async file extraction
  const triggerExtraction = async (fileState: UploadFileState) => {
    // 1. Set status to processing
    updateFileStatus(fileState.id, { status: 'processing', progress: 20 });

    try {
      const reader = new FileReader();

      if (fileState.type === 'xml') {
        reader.onload = async (e) => {
          try {
            updateFileStatus(fileState.id, { status: 'extracting', progress: 50 });
            
            const xmlText = e.target?.result as string;
            const parsed = parseXmlInvoice(xmlText, fileState.name);
            const normalized = normalizeInvoiceData(parsed, 'xml', fileState.name);
            
            updateFileStatus(fileState.id, { 
              status: 'review', 
              progress: 100, 
              extractedData: normalized 
            });
          } catch (err: any) {
            updateFileStatus(fileState.id, { 
              status: 'error', 
              progress: 0, 
              errorMessage: err.message || 'Falha ao ler ou extrair dados do XML.' 
            });
          }
        };
        reader.readAsText(fileState.file);

      } else { // pdf
        reader.onload = async (e) => {
          try {
            updateFileStatus(fileState.id, { status: 'extracting', progress: 60 });
            
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const parsed = await parsePdfInvoice(arrayBuffer, fileState.name);
            const normalized = normalizeInvoiceData(parsed, 'pdf', fileState.name);

            updateFileStatus(fileState.id, { 
              status: 'review', 
              progress: 100, 
              extractedData: normalized 
            });
          } catch (err: any) {
            updateFileStatus(fileState.id, { 
              status: 'error', 
              progress: 0, 
              errorMessage: err.message || 'Falha na leitura ou extração do PDF.' 
            });
          }
        };
        reader.readAsArrayBuffer(fileState.file);
      }

    } catch (err: any) {
      updateFileStatus(fileState.id, { 
        status: 'error', 
        progress: 0, 
        errorMessage: 'Erro interno ao carregar arquivo.' 
      });
    }
  };

  const updateFileStatus = (id: string, updates: Partial<UploadFileState>) => {
    setFileList(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const clearFile = (id: string) => {
    setFileList(prev => prev.filter(f => f.id !== id));
  };

  const getStatusBadge = (file: UploadFileState) => {
    switch (file.status) {
      case 'pending':
        return <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-semibold">Pendente</span>;
      case 'processing':
        return <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-semibold animate-pulse">Lendo...</span>;
      case 'extracting':
        return <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-semibold animate-pulse">Extraindo...</span>;
      case 'review':
        return <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-semibold">Aguardando Revisão</span>;
      case 'completed':
        return <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Salvo</span>;
      case 'error':
        return <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Falha</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-outfit text-white tracking-wide">Upload de Notas Fiscais</h2>
        <p className="text-sm text-slate-400 mt-1">Envie notas fiscais em formato XML ou PDF para alimentação automatizada do banco comercial.</p>
      </div>

      {/* Drag & Drop Box */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerClick}
        className={`glass-panel border-2 border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
          isDragActive 
            ? 'border-brand-500 bg-brand-500/5 glow-primary' 
            : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/10'
        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={!canEdit}
        />
        <div className="bg-gradient-to-tr from-brand-600 to-accent-cyan p-5 rounded-2xl shadow-xl shadow-brand-500/10 mb-4 transition-transform hover:scale-105">
          <UploadCloud className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-lg font-bold font-outfit text-white">Arraste seus arquivos aqui</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md">Ou clique para navegar em sua máquina. Suporta notas fiscais eletrônicas em formato .xml e arquivos em PDF tradicional.</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">XML (NF-e/NFC-e)</span>
          <span className="bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">PDF Selecionável</span>
          <span className="bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">Tamanho Máx: 5MB</span>
        </div>
      </div>

      {/* File List / Queue */}
      {fileList.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold font-outfit text-white">Fila de Importação ({fileList.length})</h4>
            <button 
              onClick={() => setFileList([])}
              className="text-xs text-slate-500 hover:text-slate-300 font-semibold"
            >
              Limpar fila
            </button>
          </div>

          <div className="space-y-3">
            {fileList.map((fileState) => {
              const isPdf = fileState.type === 'pdf';
              const progressWidth = `${fileState.progress}%`;
              return (
                <div 
                  key={fileState.id}
                  className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  {/* File Metadata */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isPdf ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'
                    }`}>
                      <File className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate max-w-sm" title={fileState.name}>
                        {fileState.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{(fileState.size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span className="uppercase font-bold text-[9px]">{fileState.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Extraction Progress Bar (only visible when loading) */}
                  {(fileState.status === 'processing' || fileState.status === 'extracting') && (
                    <div className="flex-1 max-w-xs px-4">
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan rounded-full transition-all duration-300"
                          style={{ width: progressWidth }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions / Status */}
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {getStatusBadge(fileState)}

                    {fileState.status === 'review' && fileState.extractedData && (
                      <button
                        onClick={() => onReviewInvoice(fileState.extractedData!)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-brand-600/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Revisar Dados</span>
                      </button>
                    )}

                    {fileState.status === 'error' && (
                      <button
                        onClick={() => triggerExtraction(fileState)}
                        className="p-1.5 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        title="Tentar novamente"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => clearFile(fileState.id)}
                      className="text-xs text-slate-500 hover:text-slate-300 font-semibold px-2 py-1.5"
                    >
                      Remover
                    </button>
                  </div>

                  {/* Detailed Error message if available */}
                  {fileState.status === 'error' && fileState.errorMessage && (
                    <div className="w-full text-[10px] text-rose-400 bg-rose-500/5 border border-rose-500/10 px-3 py-2 rounded-xl mt-2 flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{fileState.errorMessage}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
