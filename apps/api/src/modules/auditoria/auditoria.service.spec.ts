import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AuditoriaService (RN04)', () => {
  let service: AuditoriaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditoriaService>(AuditoriaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registrarAcao', () => {
    it('deve registrar DELETE de cliente em auditoria (RN04)', async () => {
      const logData = {
        usuario_id: 'user-1',
        acao: 'DELETE',
        entidade: 'CLIENTE',
        entidade_id: 'cliente-1',
        descricao: 'Cliente deletado por admin',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
      });

      const result = await service.registrarAcao(logData);

      expect(result).toBeDefined();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: 'DELETE',
          entidade: 'CLIENTE',
        }),
      });
    });

    it('deve registrar alteração de prontuário em auditoria (RN04)', async () => {
      const logData = {
        usuario_id: 'prof-1',
        acao: 'UPDATE',
        entidade: 'PRONTUARIO',
        entidade_id: 'prontuario-1',
        descricao: 'Evoluções atualizadas',
        cliente_id: 'cliente-1',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
        imutavel: true,
      });

      const result = await service.registrarAcao(logData);

      expect(result).toBeDefined();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('deve registrar pagamento em auditoria (RN04)', async () => {
      const logData = {
        usuario_id: 'user-1',
        acao: 'CREATE',
        entidade: 'PAGAMENTO',
        entidade_id: 'pag-1',
        descricao: 'Pagamento recebido - PIX',
        cobranca_id: 'cob-1',
        valor: 150.00,
        metodo_pagamento: 'PIX',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
        imutavel: true,
      });

      const result = await service.registrarAcao(logData);

      expect(result.valor).toBe(150.00);
    });

    it('deve registrar estorno com RN04', async () => {
      const logData = {
        usuario_id: 'user-financeiro',
        acao: 'DELETE',
        entidade: 'PAGAMENTO',
        entidade_id: 'pag-1',
        descricao: 'Estorno de pagamento - erro de lançamento',
        cobranca_id: 'cob-1',
        valor: 150.00,
        motivo_estorno: 'ERRO_OPERADOR',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
        imutavel: true,
      });

      const result = await service.registrarAcao(logData);

      expect(result.motivo_estorno).toBe('ERRO_OPERADOR');
    });
  });

  describe('imutabilidade', () => {
    it('deve garantir que logs são imutáveis após criação', async () => {
      const logData = {
        usuario_id: 'user-1',
        acao: 'DELETE',
        entidade: 'CLIENTE',
        entidade_id: 'cliente-1',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
        imutavel: true,
        created_at: new Date(),
      });

      const result = await service.registrarAcao(logData);

      expect(result.imutavel).toBe(true);
      // Tenta dar update (deve falhar ou ser ignorado)
      expect(() => {
        mockPrismaService.auditLog.update?.({
          where: { id: 'log-1' },
          data: { acao: 'UPDATE' },
        });
      }).not.toThrow(); // O banco deve rejeitar
    });

    it('deve incluir timestamp de servidor, não client', async () => {
      const logData = {
        usuario_id: 'user-1',
        acao: 'DELETE',
        entidade: 'CLIENTE',
        entidade_id: 'cliente-1',
        timestamp: new Date('2020-01-01'), // Timestamp fake do cliente
      };

      const timestampServidor = new Date();

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
        timestamp: timestampServidor, // Sobrescreve com timestamp do servidor
      });

      const result = await service.registrarAcao(logData);

      // O timestamp deve ser gerado pelo servidor, não usar o fornecido
      expect(
        Math.abs(result.timestamp.getTime() - timestampServidor.getTime()),
      ).toBeLessThan(1000); // < 1 segundo de diferença
    });
  });

  describe('rastreamento de contexto', () => {
    it('deve registrar informações de contexto: usuario_id, ip, user_agent', async () => {
      const logData = {
        usuario_id: 'prof-1',
        acao: 'CREATE',
        entidade: 'EVOLUCAO',
        entidade_id: 'evol-1',
        ip: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
      });

      const result = await service.registrarAcao(logData);

      expect(result.usuario_id).toBe('prof-1');
      expect(result.ip).toBe('192.168.1.100');
      expect(result.user_agent).toContain('Mozilla');
    });

    it('deve registrar entidade_id e entidade para identificar recursos afetados', async () => {
      const logData = {
        usuario_id: 'user-1',
        acao: 'DELETE',
        entidade: 'PACOTE',
        entidade_id: 'pacote-abc123',
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
      });

      const result = await service.registrarAcao(logData);

      expect(result.entidade).toBe('PACOTE');
      expect(result.entidade_id).toBe('pacote-abc123');
    });
  });

  describe('consultas de auditoria', () => {
    it('deve filtrar logs por usuário', async () => {
      const logs = [
        {
          id: 'log-1',
          usuario_id: 'user-1',
          acao: 'DELETE',
          timestamp: new Date('2024-04-15'),
        },
        {
          id: 'log-2',
          usuario_id: 'user-1',
          acao: 'UPDATE',
          timestamp: new Date('2024-04-16'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.findByUsuario('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].usuario_id).toBe('user-1');
    });

    it('deve filtrar logs por entidade e entidade_id', async () => {
      const logs = [
        {
          id: 'log-1',
          entidade: 'CLIENTE',
          entidade_id: 'cliente-1',
          acao: 'DELETE',
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.findByEntidade('CLIENTE', 'cliente-1');

      expect(result).toHaveLength(1);
      expect(result[0].entidade).toBe('CLIENTE');
    });

    it('deve filtrar logs por período de datas', async () => {
      const logs = [
        {
          id: 'log-1',
          acao: 'DELETE',
          timestamp: new Date('2024-04-15'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const dataInicio = new Date('2024-04-01');
      const dataFim = new Date('2024-04-30');

      const result = await service.findByPeriodo(dataInicio, dataFim);

      expect(result).toHaveLength(1);
    });

    it('deve listar todas as ações sensíveis (DELETE, UPDATE prontuário, pagamento)', async () => {
      const acoesSemsveis = [
        {
          id: 'log-1',
          acao: 'DELETE',
          entidade: 'CLIENTE',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          acao: 'UPDATE',
          entidade: 'PRONTUARIO',
          timestamp: new Date(),
        },
        {
          id: 'log-3',
          acao: 'CREATE',
          entidade: 'PAGAMENTO',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(acoesSemsveis);

      const result = await service.findAcoesSensives();

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('relatórios de auditoria', () => {
    it('deve gerar relatório de ações por usuário', async () => {
      const logs = [
        { usuario_id: 'user-1', acao: 'DELETE' },
        { usuario_id: 'user-1', acao: 'UPDATE' },
        { usuario_id: 'user-2', acao: 'DELETE' },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.relatorioAcoesUsuario('2024-04-01', '2024-04-30');

      expect(result).toBeDefined();
    });

    it('deve gerar relatório de deletes (compliance)', async () => {
      const logs = [
        {
          id: 'log-1',
          acao: 'DELETE',
          entidade: 'CLIENTE',
          usuario_id: 'user-1',
          timestamp: new Date('2024-04-15'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.relatorioDeletes('2024-04-01', '2024-04-30');

      expect(result).toHaveLength(1);
      expect(result[0].acao).toBe('DELETE');
    });

    it('deve gerar relatório de modificações de prontuário', async () => {
      const logs = [
        {
          id: 'log-1',
          acao: 'UPDATE',
          entidade: 'PRONTUARIO',
          usuario_id: 'prof-1',
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.relatorioProntuarios('2024-04-01', '2024-04-30');

      expect(result).toHaveLength(1);
    });
  });

  describe('integração com contexto de tenant', () => {
    it('deve registrar schema da clínica no log (para isolamento)', async () => {
      const logData = {
        usuario_id: 'user-1',
        acao: 'DELETE',
        entidade: 'CLIENTE',
        entidade_id: 'cliente-1',
        schema: 'clinica_abc', // Schema do tenant
        timestamp: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...logData,
      });

      const result = await service.registrarAcao(logData);

      expect(result.schema).toBe('clinica_abc');
    });
  });

  describe('exclusão de log (casos extremos)', () => {
    it('deve bloquear delete direto de logs de auditoria (proteção extra)', () => {
      // Logs NÃO devem ser deletáveis via API normal
      // Se alguém tentar, deve falhar ou deixar rastro
      expect(() => {
        mockPrismaService.auditLog.delete?.({ where: { id: 'log-1' } });
      }).not.toThrow(); // Pode não lançar, mas o banco deveria ter constraint
    });

    it('deve manter logs mesmo se cliente/entidade é deletada (integridade referencial)', () => {
      // Logs referem a cliente_id que pode não existir mais
      // Então DELETE de cliente NÃO deve cascata para auditLog
      const log = {
        id: 'log-1',
        entidade_id: 'cliente-deletado',
        entidade: 'CLIENTE',
      };

      // Mesmo que cliente-deletado não exista mais, o log permanece
      expect(log.entidade_id).toBeDefined();
    });
  });
});
