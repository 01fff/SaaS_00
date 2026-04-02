import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstoqueService } from './estoque.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  produto: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  entrada: {
    create: jest.fn(),
  },
  saida: {
    create: jest.fn(),
  },
};

describe('EstoqueService', () => {
  let service: EstoqueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstoqueService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EstoqueService>(EstoqueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cadastrarProduto', () => {
    it('deve cadastrar novo produto com validade', async () => {
      const createProdutoDto = {
        nome: 'Sérum Vitamina C',
        descricao: 'Sérum anti-oxidante',
        quantidade: 50,
        unidade: 'ml',
        preco_unitario: 85.00,
        data_validade: new Date('2025-12-31'),
        lote: 'LOTE-2024-001',
      };

      const produtoCriado = {
        id: 'prod-1',
        ...createProdutoDto,
        created_at: new Date(),
      };

      mockPrismaService.produto.create.mockResolvedValue(produtoCriado);

      const result = await service.cadastrarProduto(createProdutoDto);

      expect(result).toEqual(produtoCriado);
    });

    it('deve validar que quantidade é maior que zero', async () => {
      const createProdutoDto = {
        nome: 'Sérum',
        descricao: 'Descrição',
        quantidade: 0,
        unidade: 'ml',
        preco_unitario: 85.00,
        data_validade: new Date('2025-12-31'),
        lote: 'LOTE-001',
      };

      await expect(service.cadastrarProduto(createProdutoDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve validar que data_validade é no futuro', async () => {
      const createProdutoDto = {
        nome: 'Sérum',
        descricao: 'Descrição',
        quantidade: 50,
        unidade: 'ml',
        preco_unitario: 85.00,
        data_validade: new Date('2020-01-01'),
        lote: 'LOTE-001',
      };

      await expect(service.cadastrarProduto(createProdutoDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('registrarEntrada', () => {
    it('deve registrar entrada de produtos no estoque', async () => {
      const createEntradaDto = {
        produto_id: 'prod-1',
        quantidade: 20,
        lote: 'LOTE-2024-002',
        data_validade: new Date('2025-12-31'),
        data_entrada: new Date(),
      };

      const entradaCriada = {
        id: 'entrada-1',
        ...createEntradaDto,
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-1',
        quantidade: 50,
      });

      mockPrismaService.entrada.create.mockResolvedValue(entradaCriada);
      mockPrismaService.produto.update.mockResolvedValue({
        id: 'prod-1',
        quantidade: 70,
      });

      const result = await service.registrarEntrada(createEntradaDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.produto.update).toHaveBeenCalled();
    });

    it('deve lançar erro ao registrar entrada de produto inexistente', async () => {
      const createEntradaDto = {
        produto_id: 'prod-inexistente',
        quantidade: 20,
        lote: 'LOTE-001',
        data_validade: new Date('2025-12-31'),
        data_entrada: new Date(),
      };

      mockPrismaService.produto.findUnique.mockResolvedValue(null);

      await expect(service.registrarEntrada(createEntradaDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registrarSaida (RN03)', () => {
    it('deve registrar saída de produto válido', async () => {
      const createSaidaDto = {
        produto_id: 'prod-1',
        quantidade: 5,
        motivo: 'ATENDIMENTO',
        atendimento_id: 'atend-1',
        data_saida: new Date(),
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-1',
        quantidade: 50,
        data_validade: new Date('2025-12-31'),
        status: 'ATIVO',
      });

      mockPrismaService.saida.create.mockResolvedValue({
        id: 'saida-1',
        ...createSaidaDto,
      });

      mockPrismaService.produto.update.mockResolvedValue({
        id: 'prod-1',
        quantidade: 45,
      });

      const result = await service.registrarSaida(createSaidaDto);

      expect(result).toBeDefined();
    });

    it('deve bloquear uso de produto VENCIDO (RN03)', async () => {
      const createSaidaDto = {
        produto_id: 'prod-vencido',
        quantidade: 5,
        motivo: 'ATENDIMENTO',
        atendimento_id: 'atend-1',
        data_saida: new Date(),
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-vencido',
        quantidade: 50,
        data_validade: new Date('2020-01-01'), // Vencido
        status: 'ATIVO',
      });

      await expect(service.registrarSaida(createSaidaDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve bloquear uso de produto com quantidade insuficiente', async () => {
      const createSaidaDto = {
        produto_id: 'prod-1',
        quantidade: 100,
        motivo: 'ATENDIMENTO',
        atendimento_id: 'atend-1',
        data_saida: new Date(),
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-1',
        quantidade: 50,
        data_validade: new Date('2025-12-31'),
        status: 'ATIVO',
      });

      await expect(service.registrarSaida(createSaidaDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve bloquear saída de produto INATIVO', async () => {
      const createSaidaDto = {
        produto_id: 'prod-inativo',
        quantidade: 5,
        motivo: 'ATENDIMENTO',
        atendimento_id: 'atend-1',
        data_saida: new Date(),
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-inativo',
        quantidade: 50,
        data_validade: new Date('2025-12-31'),
        status: 'INATIVO',
      });

      await expect(service.registrarSaida(createSaidaDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve registrar saída com comprovante de atendimento', async () => {
      const createSaidaDto = {
        produto_id: 'prod-1',
        quantidade: 5,
        motivo: 'ATENDIMENTO',
        atendimento_id: 'atend-1',
        data_saida: new Date(),
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-1',
        quantidade: 50,
        data_validade: new Date('2025-12-31'),
        status: 'ATIVO',
      });

      mockPrismaService.saida.create.mockResolvedValue({
        id: 'saida-1',
        ...createSaidaDto,
      });

      const result = await service.registrarSaida(createSaidaDto);

      expect(result.atendimento_id).toBe('atend-1');
    });
  });

  describe('baixaAutomatica', () => {
    it('deve realizar baixa automática de produto ao concluir atendimento', async () => {
      const atendimentoData = {
        id: 'atend-1',
        cliente_id: 'cliente-1',
        procedimento: 'Limpeza de pele',
        produtos_usados: [
          { produto_id: 'prod-1', quantidade: 2 },
          { produto_id: 'prod-2', quantidade: 1 },
        ],
      };

      await service.baixaPorAtendimento(atendimentoData);

      expect(mockPrismaService.saida.create).toHaveBeenCalledTimes(2);
    });

    it('deve bloquear baixa se qualquer produto está vencido', async () => {
      const atendimentoData = {
        id: 'atend-1',
        cliente_id: 'cliente-1',
        procedimento: 'Procedimento',
        produtos_usados: [
          { produto_id: 'prod-vencido', quantidade: 2 },
        ],
      };

      mockPrismaService.produto.findUnique.mockResolvedValue({
        id: 'prod-vencido',
        data_validade: new Date('2020-01-01'),
        status: 'ATIVO',
      });

      await expect(service.baixaPorAtendimento(atendimentoData)).rejects.toThrow();
    });
  });

  describe('consultas e relatórios', () => {
    it('deve listar produtos com estoque baixo', async () => {
      const produtosBaixos = [
        { id: 'prod-1', nome: 'Sérum', quantidade: 2 },
        { id: 'prod-2', nome: 'Creme', quantidade: 3 },
      ];

      mockPrismaService.produto.findMany.mockResolvedValue(produtosBaixos);

      const result = await service.getProdutosBaixos(5);

      expect(result).toHaveLength(2);
      expect(result[0].quantidade).toBeLessThan(5);
    });

    it('deve listar produtos próximos ao vencimento', async () => {
      const proximaDataVencimento = new Date();
      proximaDataVencimento.setDate(proximaDataVencimento.getDate() + 30);

      const produtosVencerBreve = [
        {
          id: 'prod-1',
          nome: 'Sérum',
          data_validade: proximaDataVencimento,
        },
      ];

      mockPrismaService.produto.findMany.mockResolvedValue(produtosVencerBreve);

      const result = await service.getProdutosProximosVencimento(30);

      expect(result).toHaveLength(1);
    });

    it('deve retornar valor total do estoque', async () => {
      const produtos = [
        { id: 'prod-1', quantidade: 10, preco_unitario: 50.00 },
        { id: 'prod-2', quantidade: 5, preco_unitario: 100.00 },
      ];

      mockPrismaService.produto.findMany.mockResolvedValue(produtos);

      const result = await service.getEstoqueTotal();

      expect(result).toBe(1000.00); // (10 * 50) + (5 * 100)
    });
  });

  describe('validação de validade', () => {
    it('deve marcar produto como VENCIDO automaticamente', async () => {
      mockPrismaService.produto.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          data_validade: new Date('2020-01-01'),
          status: 'ATIVO',
        },
      ]);

      await service.atualizarStatusProdutosVencidos();

      expect(mockPrismaService.produto.update).toHaveBeenCalled();
    });

    it('deve considerar produto vencido se data_validade <= hoje', () => {
      const hoje = new Date();
      const vencido = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);

      expect(service.isVencido(vencido)).toBe(true);
    });

    it('deve considerar produto válido se data_validade > hoje', () => {
      const hoje = new Date();
      const valido = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);

      expect(service.isVencido(valido)).toBe(false);
    });
  });
});
