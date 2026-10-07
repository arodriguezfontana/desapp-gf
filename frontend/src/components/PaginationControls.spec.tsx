import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaginationControls } from './PaginationControls';

describe('PaginationControls', () => {
  it('renderiza los botones de página numerados y los botones de navegación', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página 5' })).toBeInTheDocument();
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

  it('deshabilita el boton Siguiente en la ultima pagina y permite Anterior', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        currentPage={5}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: /Anterior/i });
    const nextBtn = screen.getByRole('button', { name: /Siguiente/i });

    expect(nextBtn).toBeDisabled();
    expect(prevBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('no renderiza nada si no hay items', () => {
    const { container } = render(
      <PaginationControls
        currentPage={1}
        totalPages={0}
        totalItems={0}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('deshabilita ambos botones mientras isLoading es true', () => {
    render(
      <PaginationControls
        currentPage={2}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        isLoading
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeDisabled();
  });

  it('marca la pagina actual con aria-current="page"', () => {
    render(
      <PaginationControls
        currentPage={3}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    const currentBtn = screen.getByRole('button', { name: 'Página 3' });
    expect(currentBtn).toHaveAttribute('aria-current', 'page');
  });

  it('navega a la pagina correcta al hacer click en un numero', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        currentPage={3}
        totalPages={5}
        totalItems={45}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Página 5' }));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });
});
