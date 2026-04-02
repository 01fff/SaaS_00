import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  agendamento: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('AgendaService', () => {
  let service: AgendaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendaService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AgendaService>(AgendaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar agendamento válido sem conflito de horário', async () => {
      const createAgendamentoDto = {
        profissional_id: 'prof-1',
        cliente_id: 'cliente-1',
        data: new Date('2024-04-15'),
        inicio: new Date('2024-04-15 10:00:00'),
        fim: new Date('2024-04-15 11:00:00'),
        procedimento: 'Limpeza de pele',
      };

      const agendmentoCriado = {
        id: 'agend-1',
        ...createAgendamentoDto,
        status: 'AGENDADO',
        created_at: new Date(),
      };

      mockPrismaService.agendamento.findMany.mockResolvedValue([]);
      mockPrismaService.agendamento.create.mockResolvedValue(agendmentoCriado);

      const result = await service.create(createAgendamentoDto);

      expect(result).toEqual(agendmentoCriado);
      expect(mockPrismaService.agendamento.create).toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando há sobreposição de horário (RN01)', async () => {
      const novoAgendamento = {
        profissional_id: 'prof-1',
        cliente_id: 'cliente-1',
        data: new Date('2024-04-15'),
        inicio: new Date('2024-04-15 10:30:00'), // Sobrepõe
        fim: new Date('2024-04-15 11:00:00'),
        procedimento: 'Limpeza de pele',
      };

      const agendamentoExistente = {
        id: 'agend-1',
        profissional_id: 'prof-1',
        inicio: new Date('2024-04-15 10:00:00'),
        fim: new Date('2024-04-15 11:00:00'),
        status: 'AGENDADO',
      };

      // Mock: encontra agendamento que sobrepõe
      mockPrismaService.agendamento.findMany.mockResolvedValue([
        agendamentoExistente,
      ]);

      await expect(service.create(novoAgendamento)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve permitir agendamentos em horários diferentes para mesmo profissional (RN01)', async () => {
      const agendamento1 = {
        profissional_id: 'prof-1',
        cliente_id: 'cliente-1',
        data: new Date('2024-04-15'),
        inicio: new Date('2024-04-15 10:00:00'),
        fim: new Date('2024-04-15 11:00:00'),
        procedimento: 'Limpeza de pele',
      };

      const agendamento2 = {
        profissional_id: 'prof-1',
        cliente_id: 'cliente-2',
        data: new Date('2024-04-15'),
        inicio: new Date('2024-04-15 11:00:00'),
        fim: new Date('2024-04-15 12:00:00'),
        procedimento: 'Massagem',
      };

      mockPrismaService.agendamento.findMany.mockResolvedValue([]);
      mockPrismaService.agendamento.create.mockResolvedValue({
        id: 'agend-1',
        ...agendamento1,
        status: 'AGENDADO',
      });

      const result1 = await service.create(agendamento1);
      expect(result1).toBeDefined();

      // Segundo agendamento com horário diferente
      mockPrismaService.agendamento.create.mockResolvedValue({
        id: 'agend-2',
        ...agendamento2,
        status: 'AGENDADO',
      });

      const result2 = await service.create(agendamento2);
      expect(result2).toBeDefined();
    });

    it('deve bloquear agendamento para profissional sem disponibilidade', async () => {
      const agendamento = {
        profissional_id: 'prof-sem-disp',
        cliente_id: 'cliente-1',
        data: new Date('2024-04-15'),
        inicio: new Date('2024-04-15 10:00:00'),
        fim: new Date('2024-04-15 11:00:00'),
        procedimento: 'Procedimento',
      };

      mockPrismaService.agendamento.findMany.mockResolvedValue([
        { profissional_id: 'prof-sem-disp', status: 'FALTA' },
      ]);

      await expect(service.create(agendamento)).rejects.toThrow();
    });

    it('deve validar que inicio < fim', async () => {
      const agendamento = {
        profissional_id: 'prof-1',
        cliente_id: 'cliente-1',
        data: new Date('2024-04-15'),
        inicio: new Date('2024-04-15 11:00:00'),
        fim: new Date('2024-04-15 10:00:00'), // FIM < INICIO
        procedimento: 'Procedimento',
      };

      await expect(service.create(agendamento)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remarcar', () => {
    it('deve remarcar agendamento para novo horário sem conflito', async () => {
      const novoHorario = {
        data: new Date('2024-04-16'),
        inicio: new Date('2024-04-16 14:00:00'),
        fim: new Date('2024-04-16 15:00:00'),
      };

      const agendamentoAtualizado = {
        id: 'agend-1',
        status: 'AGENDADO',
        ...novoHorario,
      };

      mockPrismaService.agendamento.findUnique.mockResolvedValue({
        id: 'agend-1',
        status: 'AGENDADO',
      });
      mockPrismaService.agendamento.findMany.mockResolvedValue([]);
      mockPrismaService.agendamento.update.mockResolvedValue(
        agendamentoAtualizado,
      );

      const result = await service.remarcar('agend-1', novoHorario);

      expect(result).toEqual(agendamentoAtualizado);
    });

    it('deve bloquear remarcação para horário com conflito', async () => {
      const novoHorario = {
        data: new Date('2024-04-16'),
        inicio: new Date('2024-04-16 10:30:00'),
        fim: new Date('2024-04-16 11:00:00'),
      };

      mockPrismaService.agendamento.findUnique.mockResolvedValue({
        id: 'agend-1',
        profissional_id: 'prof-1',
        status: 'AGENDADO',
      });
      mockPrismaService.agendamento.findMany.mockResolvedValue([
        {
          id: 'agend-2',
          profissional_id: 'prof-1',
          inicio: new Date('2024-04-16 10:00:00'),
          fim: new Date('2024-04-16 11:00:00'),
        },
      ]);

      await expect(service.remarcar('agend-1', novoHorario)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve bloquear remarcação de agendamento concluído', async () => {
      const novoHorario = {
        data: new Date('2024-04-16'),
        inicio: new Date('2024-04-16 14:00:00'),
        fim: new Date('2024-04-16 15:00:00'),
      };

      mockPrismaService.agendamento.findUnique.mockResolvedValue({
        id: 'agend-1',
        status: 'CONCLUIDO',
      });

      await expect(service.remarcar('agend-1', novoHorario)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelar', () => {
    it('deve cancelar agendamento com status AGENDADO', async () => {
      mockPrismaService.agendamento.findUnique.mockResolvedValue({
        id: 'agend-1',
        status: 'AGENDADO',
      });

      mockPrismaService.agendamento.update.mockResolvedValue({
        id: 'agend-1',
        status: 'CANCELADO',
      });

      const result = await service.cancelar('agend-1');

      expect(result.status).toBe('CANCELADO');
    });

    it('deve bloquear cancelamento de agendamento concluído', async () => {
      mockPrismaService.agendamento.findUnique.mockResolvedValue({
        id: 'agend-1',
        status: 'CONCLUIDO',
      });

      await expect(service.cancelar('agend-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve bloquear cancelamento de agendamento já cancelado', async () => {
      mockPrismaService.agendamento.findUnique.mockResolvedValue({
        id: 'agend-1',
        status: 'CANCELADO',
      });

      await expect(service.cancelar('agend-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('deve retornar agendamento quando existe', async () => {
      const agendamento = {
        id: 'agend-1',
        profissional_id: 'prof-1',
        cliente_id: 'cliente-1',
        status: 'AGENDADO',
      };

      mockPrismaService.agendamento.findUnique.mockResolvedValue(
        agendamento,
      );

      const result = await service.findById('agend-1');

      expect(result).toEqual(agendamento);
    });

    it('deve lançar NotFoundException quando agendamento não existe', async () => {
      mockPrismaService.agendamento.findUnique.mockResolvedValue(null);

      await expect(service.findById('agend-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByProfissional', () => {
    it('deve retornar lista de agendamentos do profissional em intervalo de datas', async () => {
      const agendamentos = [
        {
          id: 'agend-1',
          profissional_id: 'prof-1',
          data: new Date('2024-04-15'),
          status: 'AGENDADO',
        },
      ];

      mockPrismaService.agendamento.findMany.mockResolvedValue(agendamentos);

      const result = await service.findByProfissional('prof-1', {
        dataInicio: new Date('2024-04-01'),
        dataFim: new Date('2024-04-30'),
      });

      expect(result).toEqual(agendamentos);
    });
  });

  describe('findByCliente', () => {
    it('deve retornar lista de agendamentos do cliente', async () => {
      const agendamentos = [
        {
          id: 'agend-1',
          cliente_id: 'cliente-1',
          data: new Date('2024-04-15'),
          status: 'AGENDADO',
        },
      ];

      mockPrismaService.agendamento.findMany.mockResolvedValue(agendamentos);

      const result = await service.findByCliente('cliente-1');

      expect(result).toEqual(agendamentos);
    });
  });
});
