/**
 * Script CLI para ejecutar la simulación de mercado y actividad interactiva.
 * Uso: pnpm --dir backend seed:simulation
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MarketSimulationService } from '../src/services/simulation/market-simulation.service';

async function main() {
  console.log('🚀 Iniciando contexto de aplicación para simulación de mercado...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const simulationService = app.get(MarketSimulationService);
    const result = await simulationService.simulate();
    console.log('✅ Resultado de la simulación:');
    console.dir(result, { depth: null });
  } catch (error) {
    console.error('❌ Error durante la simulación:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();

