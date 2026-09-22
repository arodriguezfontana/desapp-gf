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
    <div className="relative min-h-screen w-full bg-[#071a12] flex flex-col items-center justify-center p-4 sm:p-8 selection:bg-[#ff6b00] selection:text-white">
      <title>Iniciar sesión — Football Market</title>

      {/* Top Accent Strip */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#ff6b00] via-[#10b981] to-[#ff6b00] shadow-md z-20" />

      {/* Background Hero Image with Dark Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/stadium_hero.jpg"
          alt="Estadio de fútbol profesional"
          className="w-full h-full object-cover object-center filter brightness-40 contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071a12] via-[#071a12]/90 to-[#071a12]/50" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Floating Category Badge */}
        <div className="flex justify-center mb-4 gap-2">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0d2b1e] text-white border border-[#ff6b00]/40 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#ff6b00] animate-pulse" />
            FOOTBALL MARKET
          </span>
          <span className="px-3.5 py-1.5 bg-[#ff6b00] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
            ACCESO OFICIAL
          </span>
        </div>

        {/* Card Surface */}
        <div className="bg-[#0d2b1e] border-2 border-[#123828] p-8 sm:p-9 shadow-2xl rounded-2xl relative overflow-hidden text-white">
          {/* Card Top Accent Strip */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#ff6b00] via-[#10b981] to-[#ff6b00]" />

          <div className="text-center mb-6 pt-2">
            <div className="w-14 h-14 bg-[#071a12] border-2 border-[#ff6b00] text-[#ff6b00] font-black text-2xl mx-auto mb-3 flex items-center justify-center rounded-xl shadow-lg">
              ⚽
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wider text-white leading-none mb-2">
              Iniciar Sesión
            </h1>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Ingresá a tu cuenta para continuar
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 p-4 bg-[#ea580c]/20 border-l-4 border-[#ea580c] text-white text-xs font-black uppercase tracking-wider shadow-md rounded-md"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-black uppercase tracking-widest text-[#ff6b00] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#071a12] border border-[#123828] text-white placeholder-gray-500 text-sm font-medium focus:border-[#ff6b00] focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20 transition-all rounded-xl shadow-inner"
                placeholder="usuario@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-black uppercase tracking-widest text-[#ff6b00] mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#071a12] border border-[#123828] text-white placeholder-gray-500 text-sm font-medium focus:border-[#ff6b00] focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20 transition-all rounded-xl shadow-inner"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="mt-2 w-full bg-[#ff6b00] hover:bg-[#e05e00] text-white py-3.5 px-6 font-black uppercase tracking-widest text-xs shadow-xl hover:shadow-[#ff6b00]/40 transition-all rounded-xl border border-white/20 disabled:opacity-50 active:scale-98 cursor-pointer"
            >
              {isLoading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#123828] text-center text-xs">
            <span className="text-gray-400 font-medium">¿Aún no tenés una cuenta? </span>
            <Link
              to="/register"
              className="font-black text-[#ff6b00] hover:text-white uppercase tracking-wider transition-colors ml-1"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
