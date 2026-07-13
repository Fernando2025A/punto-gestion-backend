import { Test, TestingModule } from '@nestjs/testing';

jest.mock('src/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ProductsService } from './products.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
