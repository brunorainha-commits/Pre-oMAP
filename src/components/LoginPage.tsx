import { useState } from 'react';
import { Database, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { isCloudConfigured, isLocalModeAllowed, signInWithEmail, type CloudSession } from '../services/cloudSync';

interface LoginPageProps {
  onAuthenticated: (session: CloudSession) => void;
  onLocalMode: () => void;
}

export function LoginPage({ onAuthenticated, onLocalMode }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cloudReady = isCloudConfigured();
  const allowLocalMode = isLocalModeAllowed();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const session = await signInWithEmail(email.trim(), password);
      onAuthenticated(session);
    } catch (err: any) {
      setError(err.message || 'Falha ao entrar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-stretch">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 flex flex-col justify-between min-h-[420px]">
          <div>
            <BrandLogo size="lg" />
            <h1 className="mt-8 text-3xl sm:text-4xl font-bold font-outfit text-white max-w-xl">
              Inteligência de preço por unidade interna, pronta para operação real.
            </h1>
            <p className="mt-4 text-sm text-slate-400 max-w-2xl leading-relaxed">
              Login, sincronização em banco cloud, histórico de preços, produtos memorizados e importação de XML com conversão automática de embalagens.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <Database className="w-5 h-5 text-cyan-300" />
              <div className="mt-3 text-xs font-bold text-white">Banco cloud</div>
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">Snapshot seguro por usuário no Supabase.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <div className="mt-3 text-xs font-bold text-white">Acesso protegido</div>
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">Sessão por e-mail e senha com Auth.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <Lock className="w-5 h-5 text-amber-300" />
              <div className="mt-3 text-xs font-bold text-white">Dados persistidos</div>
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">Catálogo e notas voltam no próximo login.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl shadow-slate-950/40">
          <div className="mb-6">
            <h2 className="text-xl font-bold font-outfit text-white">Entrar no PrecoMap</h2>
            <p className="text-xs text-slate-500 mt-1">Use o usuário criado no Supabase Auth.</p>
          </div>

          {!cloudReady && (
            <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 leading-relaxed">
              Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel para ativar login e banco real.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-slate-500">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!cloudReady || isLoading}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-50"
                placeholder="operacao@empresa.com"
                required
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-slate-500">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={!cloudReady || isLoading}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-50"
                placeholder="Sua senha"
                required
              />
            </label>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!cloudReady || isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 disabled:hover:bg-cyan-500 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {allowLocalMode && (
            <button
              onClick={onLocalMode}
              className="mt-3 w-full rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              Continuar em modo local
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
