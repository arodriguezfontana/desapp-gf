import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyModal } from './ApiKeyModal';

describe('ApiKeyModal', () => {
  const fakeKey = 'pmk_1234567890abcdef1234567890abcdef';
  const fakeDate = '2026-09-16T12:00:00.000Z';

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('muestra la clave, la advertencia y responde a las acciones', async () => {
    const onClose = vi.fn();
    render(<ApiKeyModal apiKey={fakeKey} createdAt={fakeDate} onClose={onClose} />);

    expect(screen.getByText(/tu apikey/i)).toBeInTheDocument();
    expect(screen.getByText(/guardá esta clave ahora/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(fakeKey)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /copiar/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(fakeKey);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /¡copiado!/i })).toBeInTheDocument(),
    );

    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('si falla el clipboard, no rompe y mantiene el botón en su estado normal', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('permiso denegado')) },
    });

    render(<ApiKeyModal apiKey={fakeKey} createdAt={fakeDate} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(fakeKey));
    expect(screen.getByRole('button', { name: /^copiar$/i })).toBeInTheDocument();
  });

  it('vuelve a mostrar "Copiar" pasados los 2 segundos de haber copiado', async () => {
    vi.useFakeTimers();
    try {
      render(<ApiKeyModal apiKey={fakeKey} createdAt={fakeDate} onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByRole('button', { name: /¡copiado!/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole('button', { name: /^copiar$/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

