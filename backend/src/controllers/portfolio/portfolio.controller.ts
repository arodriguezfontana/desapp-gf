import { Controller, Get, Param, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { PortfolioService } from '../../services/portfolio/portfolio.service';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('users')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':id/portfolio')
  @ApiOperation({ summary: 'Consultar el portfolio de inversiones del usuario' })
  @ApiResponse({ status: 200, type: PortfolioResponseDto })
  @ApiResponse({
    status: 401,
    description: 'No autorizado (sin JWT o con JWT inválido/expirado)',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido (intento de acceder al portfolio de otro usuario)',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getPortfolio(
    @Param('id') targetUserId: string,
    @CurrentUser() currentUserId: string,
  ): Promise<PortfolioResponseDto> {
    if (targetUserId !== currentUserId) {
      throw new ForbiddenException(
        'No tienes permiso para acceder al portfolio de otro usuario.',
      );
    }

    const portfolio = await this.portfolioService.getPortfolioByUserId(targetUserId);
    return PortfolioResponseDto.fromDomain(portfolio);
  }
}

