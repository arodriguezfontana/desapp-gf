import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => { 
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getRoot', () => {
    it('devuelve el mensaje de la API', () => {
      expect(service.getRoot()).toEqual({ message: 'DESAPP API' });
    });
  });
});
