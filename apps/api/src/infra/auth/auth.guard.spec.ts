import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtService } from '@nestjs/jwt';

const mockJwtService = {
  verify: jest.fn(),
  decode: jest.fn(),
};

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('deve validar JWT válido e extrair payload', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InV1aWQtMSIsImVtYWlsIjoidXN1YXJpb0BlbWFpbC5jb20iLCJyb2xlcyI6WyJwcm9maXNzaW9uYWwiXX0';
      const payload = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        roles: ['profissional'],
      };

      mockJwtService.verify.mockReturnValue(payload);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${token}`,
            },
          }),
        }),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('deve adicionar usuário ao contexto (req.user)', () => {
      const token = 'valid.token.here';
      const payload = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        roles: ['profissional'],
      };

      mockJwtService.verify.mockReturnValue(payload);

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      guard.canActivate(mockContext as any);

      expect(req.user).toEqual(payload);
    });

    it('deve extrair corretamente: id, email, roles do JWT', () => {
      const token = 'valid.token.here';
      const payload = {
        id: 'uuid-123',
        email: 'admin@clinica.com',
        roles: ['admin', 'financeiro'],
      };

      mockJwtService.verify.mockReturnValue(payload);

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      guard.canActivate(mockContext as any);

      expect(req.user.id).toBe('uuid-123');
      expect(req.user.email).toBe('admin@clinica.com');
      expect(req.user.roles).toContain('admin');
      expect(req.user.roles).toContain('financeiro');
    });
  });

  describe('error handling', () => {
    it('deve retornar 401 quando token está faltando', () => {
      const req = {
        headers: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve retornar 401 quando Authorization header está mal formatado', () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token-here',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve retornar 401 quando token é inválido', () => {
      const token = 'invalid.token.here';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve retornar 401 quando token está expirado', () => {
      const token = 'expired.token.here';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar token sem assinatura válida', () => {
      const token = 'unsigned.token.here';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve ignorar cookies/headers inválidos e rejeitar', () => {
      const req = {
        headers: {
          authorization: 'Bearer ', // Token vazio
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('token extraction', () => {
    it('deve extrair token do header Authorization com Bearer prefix', () => {
      const token = 'valid.token.here';
      const payload = {
        id: 'uuid-1',
        email: 'user@email.com',
        roles: ['profissional'],
      };

      mockJwtService.verify.mockReturnValue(payload);

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      guard.canActivate(mockContext as any);

      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });
  });
});
