import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../service/authService';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await authService.login(email, password);
      login(res.accessToken);
      navigate('/catalog');
    } catch {
      setError('Credenciales inválidas.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 sm:p-8 selection:bg-accent selection:text-white">
      <title>Iniciar sesión — DesApp Fútbol</title>

      {/* Top Multi-Color Strip */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-accent via-secondary-bright to-accent shadow-md z-20" />

      {/* Background Hero Image with Vivid Light Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/stadium_hero.jpg"
          alt="Estadio de fútbol profesional"
          className="w-full h-full object-cover object-center filter brightness-90 contrast-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-primary/40" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Floating Category Badge */}
        <div className="flex justify-center mb-4 gap-2">
          <span className="inline-flex items-center gap-2 px-4 py-1 bg-primary text-white border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            DESAPP FÚTBOL
          </span>
          <span className="px-3.5 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
            ACCESO DE USUARIO
          </span>
        </div>

        {/* Card Surface */}
        <div className="bg-white border-2 border-primary/20 p-8 sm:p-9 shadow-2xl rounded-xs relative overflow-hidden">
          {/* Card Top Accent Strip */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary via-accent to-secondary" />

          <div className="text-center mb-6 pt-2">
            <div className="w-14 h-14 bg-primary text-white font-black text-2xl mx-auto mb-3 flex items-center justify-center rounded-xs shadow-lg border-2 border-accent">
              D
            </div>
            <h1 className="text-3xl font-black uppercase tracking-widest text-primary leading-none mb-2">
              Iniciar Sesión
            </h1>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ingresá a tu cuenta para continuar
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-700 text-xs font-black uppercase tracking-wider shadow-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-black uppercase tracking-widest text-slate-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-sm font-medium focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all rounded-xs shadow-inner"
                placeholder="usuario@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-black uppercase tracking-widest text-slate-700 mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-sm font-medium focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all rounded-xs shadow-inner"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="mt-2 w-full bg-accent hover:bg-accent-hover text-white py-3.5 px-6 font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-accent/30 transition-all rounded-xs disabled:opacity-50 active:scale-98"
            >
              {isLoading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs">
            <span className="text-slate-600 font-medium">¿Aún no tenés una cuenta? </span>
            <Link
              to="/register"
              className="font-black text-primary hover:text-accent uppercase tracking-wider transition-colors ml-1"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
