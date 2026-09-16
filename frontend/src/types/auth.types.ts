/**
 * DTOs de transferencia entre el frontend y el backend de autenticación.
 * No contienen lógica de negocio; solo definen la forma de los datos en tránsito.
 */

export interface RegisterRequestDto {
  email: string;
  password: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // segundos (86400)
}

export interface IssueApiKeyResponseDto {
  id: string;
  apiKey: string; // texto plano, prefijo pmk_
  createdAt: string; // ISO-8601
}

export interface ApiErrorDto {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
}

