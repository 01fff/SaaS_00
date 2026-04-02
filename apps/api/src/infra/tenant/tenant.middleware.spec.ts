import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { TenantService } from './tenant.service';

const mockTenantService = {
  getBySlug: jest.fn(),
};

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extraction do slug', () => {
    it('deve extrair slug do subdomínio (ex: clinicaabc.localhost)', async () => {
      const tenant = {
        id: 'uuid-1',
        slug: 'clinicaabc',
        schema_name: 'clinica_abc',
        nome: 'Clínica ABC',
        status: 'ATIVO',
      };
      mockTenantService.getBySlug.mockResolvedValue(tenant);

      const req = { hostname: 'clinicaabc.localhost' } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(mockTenantService.getBySlug).toHaveBeenCalledWith('clinicaabc');
    });

    it('deve ignorar www (ex: www.clinicaabc.localhost → clinicaabc)', async () => {
      const tenant = {
        id: 'uuid-1',
        slug: 'clinicaabc',
        schema_name: 'clinica_abc',
        nome: 'Clínica ABC',
        status: 'ATIVO',
      };
      mockTenantService.getBySlug.mockResolvedValue(tenant);

      const req = { hostname: 'www.clinicaabc.localhost' } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(mockTenantService.getBySlug).toHaveBeenCalledWith('clinicaabc');
    });
  });

  describe('integration com TenantService', () => {
    it('deve chamar TenantService.getBySlug() com slug extraído', async () => {
      const tenant = {
        id: 'uuid-1',
        slug: 'clinicaxyz',
        schema_name: 'clinica_xyz',
        nome: 'Clínica XYZ',
        status: 'ATIVO',
      };
      mockTenantService.getBySlug.mockResolvedValue(tenant);

      const req = { hostname: 'clinicaxyz.localhost' } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(mockTenantService.getBySlug).toHaveBeenCalled();
    });

    it('deve adicionar tenant ao contexto da requisição (req.tenant)', async () => {
      const tenant = {
        id: 'uuid-1',
        slug: 'clinicaabc',
        schema_name: 'clinica_abc',
        nome: 'Clínica ABC',
        status: 'ATIVO',
      };
      mockTenantService.getBySlug.mockResolvedValue(tenant);

      const req = { hostname: 'clinicaabc.localhost' } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(req.tenant).toEqual(tenant);
    });
  });

  describe('pipeline', () => {
    it('deve chamar next() para continuar o pipeline', async () => {
      const tenant = {
        id: 'uuid-1',
        slug: 'clinicaabc',
        schema_name: 'clinica_abc',
        nome: 'Clínica ABC',
        status: 'ATIVO',
      };
      mockTenantService.getBySlug.mockResolvedValue(tenant);

      const req = { hostname: 'clinicaabc.localhost' } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('deve retornar 403 quando TenantService rejeita (tenant inativo)', async () => {
      mockTenantService.getBySlug.mockRejectedValue(
        new ForbiddenException('Tenant not found or inactive'),
      );

      const req = { hostname: 'clinicainativa.localhost' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 403 quando TenantService rejeita (tenant não existe)', async () => {
      mockTenantService.getBySlug.mockRejectedValue(
        new ForbiddenException('Tenant not found or inactive'),
      );

      const req = { hostname: 'naoexiste.localhost' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('deve bloquear requisição sem subdomínio válido', async () => {
      const req = { hostname: 'localhost' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(mockTenantService.getBySlug).not.toHaveBeenCalled();
    });
  });
});
