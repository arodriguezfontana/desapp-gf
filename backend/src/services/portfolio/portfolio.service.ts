import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Portfolio } from '../../domain/portfolio/portfolio';

@Injectable()
export class PortfolioService {
  constructor(private readonly authService: AuthService) {}

  /**
   * Recupera el portfolio de inversiones del usuario.
   * Valida la existencia del usuario y retorna su portfolio.
   */
  async getPortfolioByUserId(userId: string): Promise<Portfolio> {
    await this.authService.getById(userId);

    return Portfolio.empty(userId);
  }
}

