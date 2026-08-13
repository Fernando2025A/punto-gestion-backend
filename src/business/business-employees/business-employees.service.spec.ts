import { Test, TestingModule } from '@nestjs/testing';
import { BusinessEmployeesService } from './business-employees.service';

describe('BusinessEmployeesService', () => {
  let service: BusinessEmployeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessEmployeesService],
    }).compile();

    service = module.get<BusinessEmployeesService>(BusinessEmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
