import { render, screen, fireEvent } from '@testing-library/react';
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

  it('muestra la clave, la advertencia y responde a las acciones', () => {
    const onClose = vi.fn();
    render(<ApiKeyModal apiKey={fakeKey} createdAt={fakeDate} onClose={onClose} />);

    expect(screen.getByText(/tu apikey/i)).toBeInTheDocument();
    expect(screen.getByText(/guardá esta clave ahora/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(fakeKey)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /copiar/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(fakeKey);

    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

