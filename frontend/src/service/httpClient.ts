import { authStorage } from './authStorage';
import { apiKeyStorage } from './apiKeyStorage';
import type { ApiErrorDto } from '../types/auth.types';

export interface HttpRequestOptions extends RequestInit {
  useApiKey?: boolean;
}

/**
 * Emisor de eventos para comunicar el estado HTTP a las capas superiores
 * sin que service/ importe contexts/.
 *
 * AuthContext se suscribe a 'unauthorized' (JWT)
 * CatalogPage/PlayerDetailPage se suscriben a 'apiKeyUnauthorized' (ApiKey)
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
  options: HttpRequestOptions = {},
): Promise<T> {
  const { useApiKey, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (useApiKey) {
    const apiKey = apiKeyStorage.getApiKey();
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }
  } else {
    const token = authStorage.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401) {
    if (useApiKey) {
      apiKeyStorage.clearApiKey();
      httpEvents.dispatchEvent(new Event('apiKeyUnauthorized'));
      throw new ApiError(401, 'ApiKey no válida o expirada.');
    } else {
      authStorage.clearToken();
      httpEvents.dispatchEvent(new Event('unauthorized'));
      throw new ApiError(401, 'No autorizado.');
    }
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
  get<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    return request<T>(url, { ...options, method: 'GET' });
  },

  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
};

export { ApiError };
