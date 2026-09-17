import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('lanza un error claro si se usa fuera de <AuthProvider>', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth debe usarse dentro de <AuthProvider>.',
    );
  });
});
