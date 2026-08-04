import { Test, TestingModule } from '@nestjs/testing';

jest.mock('src/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { createUser: jest.Mock; validateUser: jest.Mock; login: jest.Mock };

  beforeEach(async () => {
    authService = {
      createUser: jest.fn(),
      validateUser: jest.fn(),
      login: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    process.env.AUTH_COOKIE_NAME = 'auth_tocken';
    process.env.REFRESH_COOKIE_NAME = 'refresh_token';
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should set cookies using the configured auth cookie names', async () => {
    authService.validateUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
      provider: 'LOCAL',
    });
    authService.login.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        emailVerified: true,
        provider: 'LOCAL',
      },
    });

    const res = {
      cookie: jest.fn(),
    } as any;

    await controller.login(
      { identifier: 'alice', password: 'secret123' } as any,
      res,
    );

    expect(res.cookie).toHaveBeenCalledWith('auth_tocken', 'access-token', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', expect.any(Object));
  });

  it('should set cookies for the google callback flow from the authenticated user', async () => {
    const res = {
      cookie: jest.fn(),
    } as any;

    await controller.googleCallback(
      {
        user: {
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          user: {
            id: 'google-user',
            username: 'googleuser',
            email: 'google@example.com',
            emailVerified: true,
            provider: 'GOOGLE',
          },
        },
      } as any,
      res,
    );

    expect(res.cookie).toHaveBeenCalledWith('auth_tocken', 'google-access-token', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'google-refresh-token', expect.any(Object));
  });
});
