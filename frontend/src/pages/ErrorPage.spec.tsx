import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ErrorPage, NotFoundPage, RouteErrorPage } from './ErrorPage';

function renderAt(path: string, element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('ErrorPage', () => {
  it.each([
    [401, 'Necesitás iniciar sesión'],
    [403, 'Acceso denegado'],
    [404, 'Página no encontrada'],
    [500, 'Algo salió mal'],
    [503, 'Servicio no disponible'],
    [418, 'Ocurrió un error'],
  ])('el error %i muestra su título y su código', (status, title) => {
    renderAt('/x', <ErrorPage status={status} />);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByLabelText(`Error ${status}`)).toHaveTextContent(String(status));
  });

  it('en un 404 muestra la ruta pedida', () => {
    renderAt('/ruta/que/no/existe', <NotFoundPage />);

    expect(screen.getByText('/ruta/que/no/existe')).toBeInTheDocument();
  });

  it('un 401 lleva a iniciar sesión y los demás al inicio', () => {
    const { unmount } = renderAt('/x', <ErrorPage status={401} />);
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/login');
    unmount();

    renderAt('/x', <ErrorPage status={403} />);
    expect(screen.getByRole('link', { name: /ir al inicio/i })).toHaveAttribute('href', '/home');
  });

  it('un error de servidor ofrece reintentar y uno de cliente ofrece volver', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const user = userEvent.setup();

    const { unmount } = renderAt('/x', <ErrorPage status={500} />);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(reload).toHaveBeenCalledTimes(1);
    unmount();

    renderAt('/x', <ErrorPage status={404} />);
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

});

describe('RouteErrorPage', () => {
  it('una excepción al renderizar se muestra como 500', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Boom(): React.ReactNode {
      throw new Error('falla inesperada');
    }
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteErrorPage /> }]);

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Error 500')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
