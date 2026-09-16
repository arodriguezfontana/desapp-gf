import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renderiza la advertencia de invalidación y responde a clics en botones', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<ConfirmDialog onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText(/generar nueva apikey/i)).toBeInTheDocument();
    expect(screen.getByText(/la apikey anterior quedará invalidada/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

