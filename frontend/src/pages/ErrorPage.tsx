import { Link, isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router-dom';

interface ErrorCopy {
  title: string;
  message: string;
}

const ERROR_COPY: Record<number, ErrorCopy> = {
  401: { title: 'Necesitás iniciar sesión', message: 'Para ver esta sección tenés que ingresar con tu cuenta.' },
  403: { title: 'Acceso denegado', message: 'No tenés permisos para ver esta sección.' },
  404: { title: 'Página no encontrada', message: 'La página que buscás no existe o fue movida.' },
  500: { title: 'Algo salió mal', message: 'Ocurrió un error inesperado de nuestro lado. Probá de nuevo en unos minutos.' },
  503: { title: 'Servicio no disponible', message: 'El servicio no está disponible por el momento. Probá de nuevo en unos minutos.' },
};

const GENERIC_COPY: ErrorCopy = {
  title: 'Ocurrió un error',
  message: 'No pudimos completar lo que pediste. Probá de nuevo.',
};

const BUTTON_PRIMARY =
  'px-6 py-3 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center shadow-md active:scale-95';
const BUTTON_SECONDARY =
  'px-6 py-3 bg-[#0e3b3a] hover:bg-[#165756] text-white font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center border border-[#b79753]/40 active:scale-95';

/** Textos de cada código; los no contemplados usan uno genérico. */
function errorCopyFor(status: number): ErrorCopy {
  return ERROR_COPY[status] ?? GENERIC_COPY;
}

interface ErrorPageProps {
  /** Código HTTP del error (404, 403, 500…). */
  status: number;
}

/**
 * Página de error: un mismo diseño para los distintos errores (401, 403, 404, 500, 503 y otros).
 * No usa contextos de sesión, así que también sirve cuando falla el árbol de providers.
 */
export function ErrorPage({ status }: ErrorPageProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { title, message } = errorCopyFor(status);
  const isServerError = status >= 500;

  return (
    <main className="flex flex-col items-center justify-center text-center gap-5 px-4 py-20" role="alert">
      <title>{`${title} — FútVal`}</title>
      <span className="text-7xl sm:text-8xl font-black text-[#b79753] leading-none" aria-label={`Error ${status}`}>
        {status}
      </span>
      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">{title}</h1>
      <p className="max-w-md text-sm text-gray-300">{message}</p>
      {status === 404 && <p className="text-xs text-[#2dd4bf] font-mono break-all">{pathname}</p>}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        {status === 401 ? (
          <Link to="/login" className={BUTTON_PRIMARY}>
            Iniciar sesión
          </Link>
        ) : (
          <Link to="/home" className={BUTTON_PRIMARY}>
            Ir al inicio
          </Link>
        )}
        {isServerError ? (
          <button type="button" className={BUTTON_SECONDARY} onClick={() => window.location.reload()}>
            Reintentar
          </button>
        ) : (
          <button type="button" className={BUTTON_SECONDARY} onClick={() => navigate(-1)}>
            Volver
          </button>
        )}
      </div>
    </main>
  );
}

/** Ruta que no coincide con ninguna página: 404. */
export function NotFoundPage() {
  return <ErrorPage status={404} />;
}

/**
 * `errorElement` del router: errores de ruteo (404, 403…) y excepciones no controladas al renderizar.
 * Cualquier cosa que no sea una respuesta de ruteo se muestra como 500.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;

  return (
    <div className="min-h-screen bg-[#0b3332] text-white flex items-center justify-center">
      <ErrorPage status={status} />
    </div>
  );
}
