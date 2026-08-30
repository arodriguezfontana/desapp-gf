import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getRoot', () => {
    it('should return the root message from AppService', () => {
      const result = { message: 'DESAPP API' };
      jest.spyOn(appService, 'getRoot').mockReturnValue(result);

      expect(appController.getRoot()).toEqual(result);
    });
  });

  describe('getHealth', () => {
    it('should return a health status object', () => {
      const result = {
        status: 'ok',
        service: 'desapp-api',
        timestamp: new Date().toISOString(),
      };
      jest.spyOn(appService, 'getHealth').mockReturnValue(result);

      expect(appController.getHealth()).toEqual(result);
    });
  });
});