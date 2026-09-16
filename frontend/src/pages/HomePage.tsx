export function HomePage() {
  return (
    <div className="space-y-6">
      <title>Inicio — DesApp</title>
      <div className="bg-white border-2 border-primary p-6 shadow-sm">
        <h1 className="text-3xl font-black uppercase tracking-wider text-primary mb-2">
          Bienvenido a DesApp
        </h1>
        <p className="text-foreground/80 font-medium">
          Sistema de valuación y seguimiento de jugadores de fútbol.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-foreground/20 p-4">
          <h2 className="text-lg font-black uppercase text-foreground mb-2">
            Estado de Sesión
          </h2>
          <p className="text-sm text-foreground/70">
            Estás autenticado en el sistema. Podés gestionar tus credenciales y ApiKey desde la sección <span className="font-bold text-primary">Mi Cuenta</span>.
          </p>
        </div>

        <div className="bg-white border border-foreground/20 p-4">
          <h2 className="text-lg font-black uppercase text-foreground mb-2">
            Próximamente
          </h2>
          <p className="text-sm text-foreground/70">
            Las funcionalidades de valuación y estadísticas estarán disponibles en las próximas versiones.
          </p>
        </div>
      </div>
    </div>
  );
}
