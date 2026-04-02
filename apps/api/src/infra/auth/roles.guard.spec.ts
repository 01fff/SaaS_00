import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';

const mockReflector = {
  get: jest.fn(),
};

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('role validation', () => {
    it('deve permitir acesso quando usuário tem o perfil requerido', () => {
      mockReflector.get.mockReturnValue(['profissional']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'prof@email.com',
              roles: ['profissional'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });

    it('deve permitir acesso se usuário tem UM DOS perfis requeridos', () => {
      mockReflector.get.mockReturnValue(['recepcao', 'profissional']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'prof@email.com',
              roles: ['profissional'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });

    it('deve negar acesso quando usuário NÃO tem o perfil requerido', () => {
      mockReflector.get.mockReturnValue(['admin']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'prof@email.com',
              roles: ['profissional'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        ForbiddenException,
      );
    });

    it("deve permitir 'admin' em qualquer recurso", () => {
      mockReflector.get.mockReturnValue(['recepcao']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-admin',
              email: 'admin@email.com',
              roles: ['admin'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });

    it('deve negar acesso quando usuário não tem nenhum dos perfis requeridos', () => {
      mockReflector.get.mockReturnValue(['admin', 'financeiro']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'recepcao@email.com',
              roles: ['recepcao'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('decorator resolution', () => {
    it('deve permitir acesso sem @Roles() decorator (não restringe)', () => {
      mockReflector.get.mockReturnValue(undefined);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'usuario@email.com',
              roles: ['recepcao'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });

    it('deve permitir acesso quando @Roles() está vazio (não restringe)', () => {
      mockReflector.get.mockReturnValue([]);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'usuario@email.com',
              roles: ['recepcao'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('deve lançar ForbiddenException com mensagem descritiva', () => {
      mockReflector.get.mockReturnValue(['admin']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'prof@email.com',
              roles: ['profissional'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        ForbiddenException,
      );
    });

    it('deve bloquear requisição sem req.user (não autenticado)', () => {
      mockReflector.get.mockReturnValue(['profissional']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow();
    });
  });

  describe('multiple roles', () => {
    it('deve permitir acesso se usuário tem MÚLTIPLOS perfis', () => {
      mockReflector.get.mockReturnValue(['admin']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'super@email.com',
              roles: ['admin', 'financeiro', 'profissional'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });

    it('deve verificar corretamente com múltiplos perfis requeridos', () => {
      mockReflector.get.mockReturnValue(['recepcao', 'profissional', 'financeiro']);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'uuid-1',
              email: 'user@email.com',
              roles: ['financeiro'],
            },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);

      expect(result).toBe(true);
    });
  });
});
