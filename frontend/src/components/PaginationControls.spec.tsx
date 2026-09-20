import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaginationControls } from './PaginationControls';

describe('PaginationControls', () => {
  it('renderiza la informacion del rango visible y el total', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Mostrando/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('deshabilita el boton Anterior en la primera pagina y permite Siguiente', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        currentPage={1}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: /Anterior/i });
    const nextBtn = screen.getByRole('button', { name: /Siguiente/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

