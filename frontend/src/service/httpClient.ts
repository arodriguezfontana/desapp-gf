import { authStorage } from './authStorage';
import type { ApiErrorDto } from '../types/auth.types';

/**
 * Emisor de eventos para comunicar el estado HTTP a las capas superiores
 * sin que service/ importe contexts/ (R-003).
 *
 * AuthContext se suscribe a 'unauthorized' para limpiar la sesión cuando
 * el backend devuelve un 401.
 */
export const httpEvents = new EventTarget();

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = authStorage.getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authStorage.clearToken();
    httpEvents.dispatchEvent(new Event('unauthorized'));
    throw new ApiError(401, 'No autorizado.');
  }

  if (!response.ok) {
    let errorBody: Partial<ApiErrorDto> = {};
    try {
      errorBody = (await response.json()) as Partial<ApiErrorDto>;
    } catch {
      // cuerpo no parseable
    }
    throw new ApiError(
      errorBody.statusCode ?? response.status,
      errorBody.message ?? 'Error inesperado.',
    );
  }

  // 204 No Content y similares
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const httpClient = {
  get<T>(url: string, options?: RequestInit): Promise<T> {
    return request<T>(url, { ...options, method: 'GET' });
  },

  post<T>(url: string, body: unknown, options?: RequestInit): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export { ApiError };

