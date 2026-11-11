import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { HomePage } from './HomePage';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

/** Home actualizado: refleja las funciones actuales del producto (mercado y portafolio), no sólo catálogo y API key. */
describe('HomePage: contenido actualizado', () => {
  describe('tarjetas de funcionalidades', () => {
    it('muestra las tres funcionalidades principales', () => {
      renderHome();

      for (const title of [/catálogo y ranking/i, /comprá y vendé tokens/i, /mi portafolio/i]) {
        expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
      }
    });

    it.each([
      [/ir al catálogo/i, '/catalog'],
      [/operar en el mercado/i, '/catalog'],
      [/ver mi portafolio/i, '/portfolio'],
    ])('el llamado "%s" lleva a %s', (name, href) => {
      renderHome();
      const cards = screen.getByRole('heading', { level: 2, name: /todo lo que podés hacer/i }).closest('section')!;

      expect(within(cards).getByRole('link', { name })).toHaveAttribute('href', href);
    });

    it('cada tarjeta tiene su imagen con texto alternativo', () => {
      renderHome();
      const cards = screen.getByRole('heading', { level: 2, name: /todo lo que podés hacer/i }).closest('section')!;

      expect(within(cards).getAllByRole('img')).toHaveLength(3);
    });

    it('no presenta la gestión de la clave ni las alertas como tarjetas', () => {
      renderHome();

      expect(screen.queryByRole('heading', { level: 3, name: /gestión de clave/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 3, name: /alertas de precio/i })).not.toBeInTheDocument();
    });
  });

  describe('slides del hero', () => {
    it('el primer slide habla del mercado de tokens y lleva al catálogo', () => {
      renderHome();

      expect(screen.getByText(/comprá y vendé tokens de jugadores/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /explorar el mercado/i })).toHaveAttribute('href', '/catalog');
    });

    it('el segundo slide sigue llevando a la cuenta y la clave', () => {
      renderHome();
      fireEvent.click(screen.getByRole('button', { name: /ver slide 2/i }));

      expect(screen.getByRole('link', { name: /ir a mi cuenta & clave/i })).toHaveAttribute('href', '/account');
    });

    it('el tercer slide presenta el portafolio y lleva a /portfolio', () => {
      renderHome();
      fireEvent.click(screen.getByRole('button', { name: /ver slide 3/i }));

      expect(screen.getByText(/tu portafolio en un solo lugar/i)).toBeInTheDocument();
      // El llamado del hero y el de la tarjeta de portafolio apuntan al mismo lugar.
      const links = screen.getAllByRole('link', { name: /ver mi portafolio/i });
      expect(links).toHaveLength(2);
      for (const link of links) expect(link).toHaveAttribute('href', '/portfolio');
    });
  });
});
