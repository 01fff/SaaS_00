import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PacotesService } from './pacotes.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  pacote: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  sessaoConsumida: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe('PacotesService', () => {
  let service: PacotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PacotesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PacotesService>(PacotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um novo pacote com quantidade de sessões', async () => {
      const createPacoteDto = {
        cliente_id: 'cliente-1',
        procedimento: 'Limpeza de pele',
        quantidade_sessoes: 10,
        valor_total: 500.00,
        data_inicio: new Date('2024-04-15'),
        data_vencimento: new Date('2024-10-15'),
      };

      const pacoteCriado = {
        id: 'pacote-1',
        ...createPacoteDto,
        sessoes_consumidas: 0,
        status: 'ATIVO',
        created_at: new Date(),
      };

      mockPrismaService.pacote.create.mockResolvedValue(pacoteCriado);

      const result = await service.create(createPacoteDto);

      expect(result).toEqual(pacoteCriado);
      expect(mockPrismaService.pacote.create).toHaveBeenCalledWith({
        data: {
          ...createPacoteDto,
          sessoes_consumidas: 0,
          status: 'ATIVO',
        },
      });
    });

    it('deve validar que quantidade_sessoes é maior que zero', async () => {
      const createPacoteDto = {
        cliente_id: 'cliente-1',
        procedimento: 'Limpeza de pele',
        quantidade_sessoes: 0,
        valor_total: 500.00,
        data_inicio: new Date('2024-04-15'),
        data_vencimento: new Date('2024-10-15'),
      };

      await expect(service.create(createPacoteDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve validar que data_vencimento é após data_inicio', async () => {
      const createPacoteDto = {
        cliente_id: 'cliente-1',
        procedimento: 'Limpeza de pele',
        quantidade_sessoes: 10,
        valor_total: 500.00,
        data_inicio: new Date('2024-10-15'),
        data_vencimento: new Date('2024-04-15'),
      };

      await expect(service.create(createPacoteDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('consumir (RN02)', () => {
    it('deve consumir sessão quando atendimento é CONCLUIDO', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 0,
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);
      mockPrismaService.sessaoConsumida.create.mockResolvedValue({
        id: 'consumo-1',
        pacote_id: 'pacote-1',
        atendimento_id: 'atend-1',
        data_consumo: new Date(),
      });
      mockPrismaService.pacote.update.mockResolvedValue({
        ...pacote,
        sessoes_consumidas: 1,
      });

      const result = await service.consumirSessao('pacote-1', 'atend-1');

      expect(result.sessoes_consumidas).toBe(1);
      expect(mockPrismaService.pacote.update).toHaveBeenCalled();
    });

    it('deve lançar erro ao tentar consumir sessão quando atendimento NOT CONCLUIDO (RN02)', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 5,
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      // Atendimento não está CONCLUIDO, então não pode consumir
      await expect(
        service.consumirSessao('pacote-1', 'atend-1', 'AGENDADO'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro ao tentar consumir sessão quando pacote não tem sessões disponíveis', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 10,
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      await expect(service.consumirSessao('pacote-1', 'atend-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar erro ao tentar consumir sessão de pacote vencido', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 5,
        data_vencimento: new Date('2024-01-01'),
        status: 'VENCIDO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      await expect(service.consumirSessao('pacote-1', 'atend-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve bloquear consumo quando pacote está INATIVO', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 0,
        status: 'INATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      await expect(service.consumirSessao('pacote-1', 'atend-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve garantir que consumo é ATÔMICO (ou consome 1 ou não consome nada)', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 9,
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);
      mockPrismaService.sessaoConsumida.create.mockResolvedValue({
        id: 'consumo-1',
        pacote_id: 'pacote-1',
        atendimento_id: 'atend-1',
      });
      mockPrismaService.pacote.update.mockResolvedValue({
        ...pacote,
        sessoes_consumidas: 10,
      });

      const result = await service.consumirSessao('pacote-1', 'atend-1');

      expect(result.sessoes_consumidas).toBe(10);
      // Verifica que ambas as operações foram chamadas (transação)
      expect(mockPrismaService.sessaoConsumida.create).toHaveBeenCalled();
      expect(mockPrismaService.pacote.update).toHaveBeenCalled();
    });
  });

  describe('pendentes', () => {
    it('deve retornar quantidade de sessões pendentes (quantidade - consumidas)', async () => {
      const pacote = {
        id: 'pacote-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 3,
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      const result = await service.getSessionsPendentes('pacote-1');

      expect(result).toBe(7); // 10 - 3
    });
  });

  describe('validade', () => {
    it('deve retornar status VENCIDO quando data_vencimento passou', async () => {
      const pacote = {
        id: 'pacote-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 0,
        data_vencimento: new Date('2024-01-01'),
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      const result = await service.findById('pacote-1');

      // Deve verificar validade
      expect(service.isVencido(result.data_vencimento)).toBe(true);
    });

    it('deve retornar status ATIVO quando dentro da validade', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const pacote = {
        id: 'pacote-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 0,
        data_vencimento: futureDate,
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      const result = await service.findById('pacote-1');

      expect(service.isVencido(result.data_vencimento)).toBe(false);
    });
  });

  describe('findById', () => {
    it('deve retornar pacote quando existe', async () => {
      const pacote = {
        id: 'pacote-1',
        cliente_id: 'cliente-1',
        quantidade_sessoes: 10,
        sessoes_consumidas: 3,
        status: 'ATIVO',
      };

      mockPrismaService.pacote.findUnique.mockResolvedValue(pacote);

      const result = await service.findById('pacote-1');

      expect(result).toEqual(pacote);
    });

    it('deve lançar NotFoundException quando pacote não existe', async () => {
      mockPrismaService.pacote.findUnique.mockResolvedValue(null);

      await expect(service.findById('pacote-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCliente', () => {
    it('deve retornar lista de pacotes ativos do cliente', async () => {
      const pacotes = [
        {
          id: 'pacote-1',
          quantidade_sessoes: 10,
          sessoes_consumidas: 3,
          status: 'ATIVO',
        },
        {
          id: 'pacote-2',
          quantidade_sessoes: 5,
          sessoes_consumidas: 5,
          status: 'CONCLUIDO',
        },
      ];

      mockPrismaService.pacote.findMany.mockResolvedValue([pacotes[0]]);

      const result = await service.findByCliente('cliente-1', { status: 'ATIVO' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('ATIVO');
    });
  });

  describe('historicoConsumo', () => {
    it('deve retornar histórico de sessões consumidas de um pacote', async () => {
      const historicoConsumo = [
        {
          id: 'consumo-1',
          pacote_id: 'pacote-1',
          atendimento_id: 'atend-1',
          data_consumo: new Date('2024-04-10'),
        },
        {
          id: 'consumo-2',
          pacote_id: 'pacote-1',
          atendimento_id: 'atend-2',
          data_consumo: new Date('2024-04-15'),
        },
      ];

      mockPrismaService.sessaoConsumida.findMany.mockResolvedValue(
        historicoConsumo,
      );

      const result = await service.getHistoricoConsumo('pacote-1');

      expect(result).toEqual(historicoConsumo);
      expect(result).toHaveLength(2);
    });
  });
});
