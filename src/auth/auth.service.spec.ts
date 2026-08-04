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
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    userToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userToken: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
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
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      emailVerified: false,
      provider: 'LOCAL',
      password: 'hashed-password',
    });

    const result = await service.createUser({
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret123',
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.username).toBe('alice');
    expect(result.emailVerified).toBe(false);
  });

  it('should validate a user with email or username as identifier', async () => {
    const hashedPassword = await bcrypt.hash('secret123', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      password: hashedPassword,
      emailVerified: true,
      provider: 'LOCAL',
    });

    const result = await service.validateUser('alice@example.com', 'secret123');

    expect(result?.username).toBe('alice');
    expect(result?.email).toBe('alice@example.com');
  });

  it('should create a google user when profile has no existing account', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: 'google@example.com',
        name: 'Google User',
      }),
    });
    (global as typeof globalThis & { fetch: jest.Mock }).fetch = fetchMock;

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-2',
      username: 'googleuser',
      email: 'google@example.com',
      emailVerified: true,
      provider: 'GOOGLE',
      password: null,
    });

    const result = await service.googleLogin({ accessToken: 'google-token' });

    expect(result.user.email).toBe('google@example.com');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should exchange a Google authorization code for a user session', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'google-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: 'callback@example.com',
          name: 'Callback User',
        }),
      });
    (global as typeof globalThis & { fetch: jest.Mock }).fetch = fetchMock;

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-3',
      username: 'callbackuser',
      email: 'callback@example.com',
      emailVerified: true,
      provider: 'GOOGLE',
      password: null,
    });

    const result = await service.googleCallback({
      code: 'auth-code',
      redirectUri: 'http://localhost:3000/auth/google/callback',
    });

    expect(result.user.email).toBe('callback@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should issue an access token and a refresh token on login', async () => {
    const result = await service.login({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
      provider: 'LOCAL',
    });

    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(prisma.userToken.deleteMany).toHaveBeenCalled();
    expect(prisma.userToken.create).toHaveBeenCalled();
  });
});
