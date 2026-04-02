import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  cliente: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ClientesService', () => {
  let service: ClientesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um novo cliente com dados válidos', async () => {
      const createClienteDto = {
        nome: 'João Silva',
        cpf: '12345678901',
        telefone: '11987654321',
        email: 'joao@email.com',
        data_nascimento: new Date('1990-05-15'),
      };

      const clienteCriado = {
        id: 'uuid-1',
        ...createClienteDto,
        created_at: new Date(),
      };

      mockPrismaService.cliente.create.mockResolvedValue(clienteCriado);

      const result = await service.create(createClienteDto);

      expect(result).toEqual(clienteCriado);
      expect(mockPrismaService.cliente.create).toHaveBeenCalledWith({
        data: createClienteDto,
      });
    });

    it('deve lançar erro ao criar cliente com CPF duplicado', async () => {
      const createClienteDto = {
        nome: 'João Silva',
        cpf: '12345678901',
        telefone: '11987654321',
        email: 'joao@email.com',
        data_nascimento: new Date('1990-05-15'),
      };

      mockPrismaService.cliente.create.mockRejectedValue(
        new Error('Unique constraint failed on cpf'),
      );

      await expect(service.create(createClienteDto)).rejects.toThrow();
    });

    it('deve lançar erro ao criar cliente sem email', async () => {
      const createClienteDto = {
        nome: 'João Silva',
        cpf: '12345678901',
        telefone: '11987654321',
        email: '',
        data_nascimento: new Date('1990-05-15'),
      };

      await expect(service.create(createClienteDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar erro ao criar cliente sem nome', async () => {
      const createClienteDto = {
        nome: '',
        cpf: '12345678901',
        telefone: '11987654321',
        email: 'joao@email.com',
        data_nascimento: new Date('1990-05-15'),
      };

      await expect(service.create(createClienteDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('deve retornar cliente quando existe', async () => {
      const cliente = {
        id: 'uuid-1',
        nome: 'João Silva',
        cpf: '12345678901',
        email: 'joao@email.com',
        created_at: new Date(),
      };

      mockPrismaService.cliente.findUnique.mockResolvedValue(cliente);

      const result = await service.findById('uuid-1');

      expect(result).toEqual(cliente);
      expect(mockPrismaService.cliente.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('deve lançar NotFoundException quando cliente não existe', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(null);

      await expect(service.findById('uuid-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('deve retornar lista de clientes', async () => {
      const clientes = [
        {
          id: 'uuid-1',
          nome: 'João Silva',
          email: 'joao@email.com',
          created_at: new Date(),
        },
        {
          id: 'uuid-2',
          nome: 'Maria Santos',
          email: 'maria@email.com',
          created_at: new Date(),
        },
      ];

      mockPrismaService.cliente.findMany.mockResolvedValue(clientes);

      const result = await service.findAll();

      expect(result).toEqual(clientes);
      expect(mockPrismaService.cliente.findMany).toHaveBeenCalled();
    });

    it('deve retornar lista vazia quando não há clientes', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('deve suportar paginação', async () => {
      const clientes = [
        {
          id: 'uuid-1',
          nome: 'João Silva',
          email: 'joao@email.com',
          created_at: new Date(),
        },
      ];

      mockPrismaService.cliente.findMany.mockResolvedValue(clientes);

      const result = await service.findAll({ skip: 0, take: 10 });

      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
    });
  });

  describe('update', () => {
    it('deve atualizar cliente com dados válidos', async () => {
      const updateClienteDto = {
        nome: 'João Silva Atualizado',
        telefone: '11999999999',
      };

      const clienteAtualizado = {
        id: 'uuid-1',
        nome: 'João Silva Atualizado',
        cpf: '12345678901',
        email: 'joao@email.com',
        telefone: '11999999999',
        updated_at: new Date(),
      };

      mockPrismaService.cliente.update.mockResolvedValue(clienteAtualizado);

      const result = await service.update('uuid-1', updateClienteDto);

      expect(result).toEqual(clienteAtualizado);
      expect(mockPrismaService.cliente.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: updateClienteDto,
      });
    });

    it('deve lançar NotFoundException ao atualizar cliente inexistente', async () => {
      mockPrismaService.cliente.update.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.update('uuid-inexistente', { nome: 'Novo Nome' }),
      ).rejects.toThrow();
    });

    it('deve impedir atualização de CPF (campo imutável)', async () => {
      const updateClienteDto = {
        cpf: '98765432109', // Tentando mudar CPF
      };

      await expect(service.update('uuid-1', updateClienteDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('deve deletar cliente quando existe', async () => {
      mockPrismaService.cliente.delete.mockResolvedValue({
        id: 'uuid-1',
        nome: 'João Silva',
      });

      await service.delete('uuid-1');

      expect(mockPrismaService.cliente.delete).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('deve lançar NotFoundException ao deletar cliente inexistente', async () => {
      mockPrismaService.cliente.delete.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(service.delete('uuid-inexistente')).rejects.toThrow();
    });
  });

  describe('histórico de atendimentos', () => {
    it('deve retornar histórico de atendimentos do cliente', async () => {
      const historico = [
        {
          id: 'atend-1',
          data: new Date('2024-01-15'),
          procedimento: 'Limpeza de pele',
          profissional: 'Maria',
        },
        {
          id: 'atend-2',
          data: new Date('2024-01-22'),
          procedimento: 'Massagem',
          profissional: 'João',
        },
      ];

      mockPrismaService.cliente.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nome: 'João Silva',
        atendimentos: historico,
      });

      const result = await service.findAtendimentosHistorico('uuid-1');

      expect(result).toEqual(historico);
    });

    it('deve retornar lista vazia quando cliente não tem atendimentos', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nome: 'João Silva',
        atendimentos: [],
      });

      const result = await service.findAtendimentosHistorico('uuid-1');

      expect(result).toEqual([]);
    });
  });
});
