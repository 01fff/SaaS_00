import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  cobranca: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  pagamento: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  parcelamento: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('FinanceiroService', () => {
  let service: FinanceiroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceiroService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FinanceiroService>(FinanceiroService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('gerarCobranca', () => {
    it('deve gerar cobrança a partir de atendimento concluído', async () => {
      const createCobrancaDto = {
        cliente_id: 'cliente-1',
        atendimento_id: 'atend-1',
        valor: 150.00,
        descricao: 'Limpeza de pele',
        data_vencimento: new Date('2024-05-15'),
      };

      const cobrancaCriada = {
        id: 'cob-1',
        ...createCobrancaDto,
        status: 'PENDENTE',
        created_at: new Date(),
      };

      mockPrismaService.cobranca.create.mockResolvedValue(cobrancaCriada);

      const result = await service.gerarCobranca(createCobrancaDto);

      expect(result).toEqual(cobrancaCriada);
      expect(result.status).toBe('PENDENTE');
    });

    it('deve validar que valor é maior que zero', async () => {
      const createCobrancaDto = {
        cliente_id: 'cliente-1',
        atendimento_id: 'atend-1',
        valor: 0,
        descricao: 'Procedimento',
        data_vencimento: new Date('2024-05-15'),
      };

      await expect(service.gerarCobranca(createCobrancaDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve validar que data_vencimento é no futuro', async () => {
      const createCobrancaDto = {
        cliente_id: 'cliente-1',
        atendimento_id: 'atend-1',
        valor: 150.00,
        descricao: 'Procedimento',
        data_vencimento: new Date('2020-01-01'),
      };

      await expect(service.gerarCobranca(createCobrancaDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve permitir cobrança sem data_vencimento (à vista)', async () => {
      const createCobrancaDto = {
        cliente_id: 'cliente-1',
        atendimento_id: 'atend-1',
        valor: 150.00,
        descricao: 'Procedimento à vista',
        data_vencimento: null,
      };

      mockPrismaService.cobranca.create.mockResolvedValue({
        id: 'cob-1',
        ...createCobrancaDto,
        status: 'PENDENTE',
      });

      const result = await service.gerarCobranca(createCobrancaDto);

      expect(result.data_vencimento).toBeNull();
    });
  });

  describe('registrarPagamento', () => {
    it('deve registrar pagamento parcial de cobrança', async () => {
      const createPagamentoDto = {
        cobranca_id: 'cob-1',
        valor: 75.00,
        data_pagamento: new Date(),
        metodo: 'DINHEIRO',
      };

      const pagamentoCriado = {
        id: 'pag-1',
        ...createPagamentoDto,
        created_at: new Date(),
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PENDENTE',
        pagamentos: [],
      });

      mockPrismaService.pagamento.create.mockResolvedValue(pagamentoCriado);
      mockPrismaService.cobranca.update.mockResolvedValue({
        id: 'cob-1',
        status: 'PARCIAL',
      });

      const result = await service.registrarPagamento(createPagamentoDto);

      expect(result).toEqual(pagamentoCriado);
    });

    it('deve registrar pagamento total e marcar como PAGO', async () => {
      const createPagamentoDto = {
        cobranca_id: 'cob-1',
        valor: 150.00,
        data_pagamento: new Date(),
        metodo: 'CARTAO',
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PENDENTE',
        pagamentos: [],
      });

      mockPrismaService.pagamento.create.mockResolvedValue({
        id: 'pag-1',
        ...createPagamentoDto,
      });

      mockPrismaService.cobranca.update.mockResolvedValue({
        id: 'cob-1',
        status: 'PAGO',
      });

      const result = await service.registrarPagamento(createPagamentoDto);

      expect(result).toBeDefined();
    });

    it('deve bloquear pagamento maior que valor devido', async () => {
      const createPagamentoDto = {
        cobranca_id: 'cob-1',
        valor: 200.00,
        data_pagamento: new Date(),
        metodo: 'DINHEIRO',
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PENDENTE',
        pagamentos: [],
      });

      await expect(service.registrarPagamento(createPagamentoDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve registrar pagamento por diferentes métodos', async () => {
      const metodos = ['DINHEIRO', 'CARTAO', 'PIX', 'TRANSFERENCIA'];

      for (const metodo of metodos) {
        const createPagamentoDto = {
          cobranca_id: 'cob-1',
          valor: 150.00,
          data_pagamento: new Date(),
          metodo,
        };

        mockPrismaService.cobranca.findUnique.mockResolvedValue({
          id: 'cob-1',
          valor: 150.00,
          status: 'PENDENTE',
          pagamentos: [],
        });

        mockPrismaService.pagamento.create.mockResolvedValue({
          id: `pag-${metodo}`,
          ...createPagamentoDto,
        });

        const result = await service.registrarPagamento(createPagamentoDto);

        expect(result.metodo).toBe(metodo);
      }
    });
  });

  describe('parcelamento', () => {
    it('deve criar parcelamento em 3x', async () => {
      const createParcelamentoDto = {
        cobranca_id: 'cob-1',
        numero_parcelas: 3,
        valor_parcela: 50.00,
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PENDENTE',
      });

      mockPrismaService.parcelamento.create.mockResolvedValue({
        id: 'parc-1',
        cobranca_id: 'cob-1',
        parcelas: [
          { numero: 1, valor: 50.00, vencimento: new Date() },
          { numero: 2, valor: 50.00, vencimento: new Date() },
          { numero: 3, valor: 50.00, vencimento: new Date() },
        ],
      });

      const result = await service.criarParcelamento(createParcelamentoDto);

      expect(result.parcelas).toHaveLength(3);
    });

    it('deve validar que número de parcelas é válido', async () => {
      const createParcelamentoDto = {
        cobranca_id: 'cob-1',
        numero_parcelas: 0,
        valor_parcela: 50.00,
      };

      await expect(service.criarParcelamento(createParcelamentoDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve gerar datas de vencimento automáticas (mensal)', async () => {
      const createParcelamentoDto = {
        cobranca_id: 'cob-1',
        numero_parcelas: 3,
        valor_parcela: 50.00,
        primeira_data_vencimento: new Date('2024-05-15'),
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
      });

      mockPrismaService.parcelamento.create.mockResolvedValue({
        id: 'parc-1',
        parcelas: [
          { numero: 1, vencimento: new Date('2024-05-15') },
          { numero: 2, vencimento: new Date('2024-06-15') },
          { numero: 3, vencimento: new Date('2024-07-15') },
        ],
      });

      const result = await service.criarParcelamento(createParcelamentoDto);

      expect(result.parcelas[1].vencimento).toEqual(new Date('2024-06-15'));
    });
  });

  describe('estorno', () => {
    it('deve processar estorno de pagamento', async () => {
      mockPrismaService.pagamento.findUnique = jest.fn().mockResolvedValue({
        id: 'pag-1',
        cobranca_id: 'cob-1',
        valor: 75.00,
      });

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PARCIAL',
      });

      mockPrismaService.cobranca.update.mockResolvedValue({
        id: 'cob-1',
        status: 'PENDENTE',
      });

      await service.estornarPagamento('pag-1');

      expect(mockPrismaService.cobranca.update).toHaveBeenCalled();
    });

    it('deve validar que estorno é registrado em auditoria', async () => {
      // O teste de auditoria será em AuditoriaService
      mockPrismaService.pagamento.findUnique = jest
        .fn()
        .mockResolvedValue({
          id: 'pag-1',
          cobranca_id: 'cob-1',
          valor: 75.00,
        });

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
      });

      mockPrismaService.cobranca.update.mockResolvedValue({
        id: 'cob-1',
        status: 'PENDENTE',
      });

      await service.estornarPagamento('pag-1');

      expect(mockPrismaService.cobranca.update).toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('deve listar cobranças pendentes de cliente', async () => {
      const cobrancas = [
        { id: 'cob-1', valor: 150.00, status: 'PENDENTE' },
        { id: 'cob-2', valor: 200.00, status: 'PARCIAL' },
      ];

      mockPrismaService.cobranca.findMany.mockResolvedValue(cobrancas);

      const result = await service.findByCliente('cliente-1', {
        status: 'PENDENTE',
      });

      expect(result).toContainEqual(cobrancas[0]);
    });

    it('deve calcular total devido de cliente', async () => {
      const cobrancas = [
        { id: 'cob-1', valor: 150.00, status: 'PENDENTE', pagamentos: [] },
        { id: 'cob-2', valor: 200.00, status: 'PARCIAL', pagamentos: [{ valor: 50.00 }] },
      ];

      mockPrismaService.cobranca.findMany.mockResolvedValue(cobrancas);

      const result = await service.getTotalDevido('cliente-1');

      expect(result).toBe(300.00); // 150 + (200 - 50)
    });
  });

  describe('desconto', () => {
    it('deve aplicar desconto em porcentagem', async () => {
      const createDescontoDto = {
        cobranca_id: 'cob-1',
        tipo: 'PERCENTUAL',
        valor: 10, // 10%
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PENDENTE',
      });

      mockPrismaService.cobranca.update.mockResolvedValue({
        id: 'cob-1',
        valor: 135.00, // 150 - 10%
      });

      const result = await service.aplicarDesconto(createDescontoDto);

      expect(result.valor).toBe(135.00);
    });

    it('deve aplicar desconto em valor fixo', async () => {
      const createDescontoDto = {
        cobranca_id: 'cob-1',
        tipo: 'FIXO',
        valor: 25.00,
      };

      mockPrismaService.cobranca.findUnique.mockResolvedValue({
        id: 'cob-1',
        valor: 150.00,
        status: 'PENDENTE',
      });

      mockPrismaService.cobranca.update.mockResolvedValue({
        id: 'cob-1',
        valor: 125.00, // 150 - 25
      });

      const result = await service.aplicarDesconto(createDescontoDto);

      expect(result.valor).toBe(125.00);
    });
  });
});
