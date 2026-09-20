import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('retorna el valor inicial de inmediato', () => {
    const { result } = renderHook(() => useDebounce('Boca', 400));
    expect(result.current).toBe('Boca');
  });

  it('actualiza el valor retornado únicamente después de transcurrido el delay', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'Boca', delay: 400 } },
    );

    expect(result.current).toBe('Boca');

    rerender({ value: 'Boca Juniors', delay: 400 });
    // Todavía no pasó el tiempo
    expect(result.current).toBe('Boca');

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe('Boca');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('Boca Juniors');

    vi.useRealTimers();
  });
});

