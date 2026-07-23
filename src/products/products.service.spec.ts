import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { afterEach, beforeEach, describe } from 'node:test';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: PrismaService;

  //Objeto simulado con métodos prisma
  const mockPrismaService = {
    inventory: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService, //Inyectamos la simulación
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get<PrismaService>(PrismaService)
  });

  //Limpiamos los rastros de llamadas entre cada test
  afterEach(() => {
    jest.crearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefinde();
  })
});
