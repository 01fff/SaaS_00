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

  it('deve definir req.tenantSchema quando tenant é válido', async () => {
    const req = { hostname: 'clinicaabc.seuapp.com' } as any;
    const res = {} as any;
    const next = jest.fn();

    mockTenantService.getBySlug.mockResolvedValue({
      schema_name: 'clinica_abc',
    });

    await middleware.use(req, res, next);

    expect(req.tenantSchema).toBe('clinica_abc');
    expect(mockTenantService.getBySlug).toHaveBeenCalledWith('clinicaabc');
    expect(next).toHaveBeenCalled();
  });

  it('deve propagar ForbiddenException quando tenant não existe', async () => {
    const req = { hostname: 'naoexiste.seuapp.com' } as any;
    const res = {} as any;
    const next = jest.fn();

    mockTenantService.getBySlug.mockRejectedValue(new ForbiddenException());

    await expect(middleware.use(req, res, next)).rejects.toThrow(
      ForbiddenException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('deve extrair o slug corretamente do hostname', async () => {
    const req = { hostname: 'minhaClinica.seuapp.com' } as any;
    const res = {} as any;
    const next = jest.fn();

    mockTenantService.getBySlug.mockResolvedValue({
      schema_name: 'minha_clinica',
    });

    await middleware.use(req, res, next);

    expect(mockTenantService.getBySlug).toHaveBeenCalledWith('minhaClinica');
    expect(next).toHaveBeenCalled();
  });
});
