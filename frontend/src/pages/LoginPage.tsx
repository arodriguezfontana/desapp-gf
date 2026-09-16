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
      navigate('/home');
    } catch {
      // Siempre mostrar el mensaje genérico exigido por backend y spec
      setError('Credenciales inválidas.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 text-foreground">
      <title>Iniciar sesión — DesApp</title>
      <div className="w-full max-w-md bg-white border-2 border-primary p-6 shadow-md">
        <h1 className="text-2xl font-black uppercase tracking-wider text-primary mb-6 text-center">
          Iniciar Sesión
        </h1>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-50 border border-red-600 text-red-600 text-sm font-semibold"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-foreground/30 focus:border-primary focus:outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-foreground/30 focus:border-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="mt-2 w-full bg-primary text-white py-2 font-black uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-foreground/70">¿No tenés una cuenta? </span>
          <Link to="/register" className="font-bold text-primary hover:underline">
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
}
