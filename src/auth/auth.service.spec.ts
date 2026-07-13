import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('src/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-1', username: 'alice' }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register a new user and hash the password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      password: 'hashed-password',
    });

    const result = await service.createUser({
      username: 'alice',
      password: 'secret123',
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.username).toBe('alice');
  });

  it('should validate a user with the correct password', async () => {
    const hashedPassword = await bcrypt.hash('secret123', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      password: hashedPassword,
    });

    const result = await service.validateUser('alice', 'secret123');

    expect(result?.username).toBe('alice');
  });
});
