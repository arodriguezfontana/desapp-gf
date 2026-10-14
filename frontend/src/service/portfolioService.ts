import { httpClient } from './httpClient';
import type { PortfolioResponse } from '../types/portfolio';

export const portfolioService = {
  async getPortfolio(userId: string): Promise<PortfolioResponse> {
    return httpClient.get<PortfolioResponse>(`/users/${encodeURIComponent(userId)}/portfolio`);
  },
};

