import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from '../service/auth.service';
import { CurrentUser } from '../guards/current-user.decorator';
import { Public } from '../guards/public.decorator';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Alta de cuenta (no inicia sesión, no devuelve token)' })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Body inválido o contraseña que incumple la política' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async register(@Body() dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    const user = await this.auth.register(dto.email, dto.password);
    return RegisterResponseDto.fromDomain(user);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicio de sesión — devuelve un JWT válido por 24 h' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Falta email o password' })
  @ApiResponse({
    status: 401,
    description:
      'Credenciales inválidas. Respuesta idéntica para email inexistente y contraseña incorrecta.',
  })
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    const accessToken = await this.auth.login(dto.email, dto.password);
    return new LoginResponseDto(accessToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado (endpoint protegido de referencia)' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Sin JWT, o con uno inválido o vencido' })
  async me(@CurrentUser() userId: string): Promise<MeResponseDto> {
    const user = await this.auth.getById(userId);
    return MeResponseDto.fromDomain(user);
  }
}
