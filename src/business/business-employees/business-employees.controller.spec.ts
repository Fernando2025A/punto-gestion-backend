import { Test, TestingModule } from '@nestjs/testing';
import { BusinessEmployeesController } from './business-employees.controller';
import { BusinessEmployeesService } from './business-employees.service';

describe('BusinessEmployeesController', () => {
  let controller: BusinessEmployeesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessEmployeesController],
      providers: [BusinessEmployeesService],
    }).compile();

    controller = module.get<BusinessEmployeesController>(BusinessEmployeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
