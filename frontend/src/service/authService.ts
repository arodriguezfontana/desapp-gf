import { httpClient } from './httpClient';
import type { LoginResponseDto, IssueApiKeyResponseDto } from '../types/auth.types';

/**
 * Operaciones de autenticación del cliente.
 * Esta capa es la única que llama a los endpoints de auth del backend.
 */
export const authService = {
  /**
   * Registra una cuenta nueva.
   * Lanza ApiError si el backend devuelve un error (email duplicado, contraseña débil, etc.).
   */
  async register(email: string, password: string): Promise<void> {
    await httpClient.post<void>('/auth/register', { email, password });
  },

  /**
   * Inicia sesión y devuelve el LoginResponseDto con el JWT.
   * Lanza ApiError si las credenciales son inválidas.
   */
  async login(email: string, password: string): Promise<LoginResponseDto> {
    return httpClient.post<LoginResponseDto>('/auth/login', { email, password });
  },

  /**
   * Genera una nueva ApiKey para el usuario autenticado.
   * Requiere un JWT válido en el header (lo inyecta httpClient automáticamente).
   * Lanza ApiError si el JWT es inválido o expiró.
   */
  async generateApiKey(): Promise<IssueApiKeyResponseDto> {
    return httpClient.post<IssueApiKeyResponseDto>('/auth/api-key', {});
  },
};

