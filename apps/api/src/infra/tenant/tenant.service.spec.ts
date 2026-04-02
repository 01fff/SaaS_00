import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  tenant: {
    findUnique: jest.fn(),
  },
};

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBySlug', () => {
    it('deve retornar o tenant quando existe e está ATIVO', async () => {
      const tenant = {
        id: 'uuid-1',
        slug: 'clinicaabc',
        schema_name: 'clinica_abc',
        nome: 'Clínica ABC',
        status: 'ATIVO',
      };
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getBySlug('clinicaabc');

      expect(result).toEqual(tenant);
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'clinicaabc' },
      });
    });

    it('deve lançar ForbiddenException quando tenant não existe', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug('naoexiste')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve lançar ForbiddenException quando tenant está INATIVO', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'uuid-2',
        slug: 'clinicainativa',
        schema_name: 'clinica_inativa',
        nome: 'Clínica Inativa',
        status: 'INATIVO',
      });

      await expect(service.getBySlug('clinicainativa')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve lançar ForbiddenException quando tenant está SUSPENSO', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'uuid-3',
        slug: 'clinicasuspensa',
        schema_name: 'clinica_suspensa',
        nome: 'Clínica Suspensa',
        status: 'SUSPENSO',
      });

      await expect(service.getBySlug('clinicasuspensa')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
