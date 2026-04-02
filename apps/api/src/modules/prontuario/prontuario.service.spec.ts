import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProntuarioService } from './prontuario.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockPrismaService = {
  anamnese: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  evolucao: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  termo: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ProntuarioService', () => {
  let service: ProntuarioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProntuarioService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProntuarioService>(ProntuarioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('criarAnamnese', () => {
    it('deve criar anamnese para cliente primeira vez', async () => {
      const createAnamneseDto = {
        cliente_id: 'cliente-1',
        queixa_principal: 'Acne',
        historico_doencas: 'Nenhuma alergia conhecida',
        medicamentos: 'Nenhum',
        cirurgias: 'Nenhuma',
        data_criacao: new Date(),
      };

      const anamneseCriada = {
        id: 'anamnese-1',
        ...createAnamneseDto,
        created_at: new Date(),
      };

      mockPrismaService.anamnese.create.mockResolvedValue(anamneseCriada);

      const result = await service.criarAnamnese(createAnamneseDto);

      expect(result).toEqual(anamneseCriada);
    });

    it('deve validar campos obrigatórios na anamnese', async () => {
      const createAnamneseDto = {
        cliente_id: '',
        queixa_principal: 'Acne',
        historico_doencas: 'Nenhuma',
        medicamentos: 'Nenhum',
        cirurgias: 'Nenhuma',
        data_criacao: new Date(),
      };

      await expect(service.criarAnamnese(createAnamneseDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('atualizarAnamnese', () => {
    it('deve atualizar anamnese existente', async () => {
      const updateAnamneseDto = {
        queixa_principal: 'Acne severa',
        medicamentos: 'Vitamina D',
      };

      const anamneseAtualizada = {
        id: 'anamnese-1',
        cliente_id: 'cliente-1',
        queixa_principal: 'Acne severa',
        medicamentos: 'Vitamina D',
        updated_at: new Date(),
      };

      mockPrismaService.anamnese.update.mockResolvedValue(anamneseAtualizada);

      const result = await service.atualizarAnamnese('anamnese-1', updateAnamneseDto);

      expect(result).toEqual(anamneseAtualizada);
    });

    it('deve lançar NotFoundException quando anamnese não existe', async () => {
      mockPrismaService.anamnese.update.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.atualizarAnamnese('anamnese-inexistente', {}),
      ).rejects.toThrow();
    });
  });

  describe('criarEvolucao', () => {
    it('deve criar evolução de atendimento', async () => {
      const createEvolucaoDto = {
        atendimento_id: 'atend-1',
        cliente_id: 'cliente-1',
        descricao: 'Pele melhorou significativamente',
        intercorrencias: 'Nenhuma',
        proximo_procedimento: 'Limpeza profunda',
        data_evolucao: new Date(),
      };

      const evolucaoCriada = {
        id: 'evol-1',
        ...createEvolucaoDto,
        created_at: new Date(),
      };

      mockPrismaService.evolucao.create.mockResolvedValue(evolucaoCriada);

      const result = await service.criarEvolucao(createEvolucaoDto);

      expect(result).toEqual(evolucaoCriada);
    });

    it('deve validar que descrição não está vazia', async () => {
      const createEvolucaoDto = {
        atendimento_id: 'atend-1',
        cliente_id: 'cliente-1',
        descricao: '',
        intercorrencias: '',
        proxima_procedimento: '',
        data_evolucao: new Date(),
      };

      await expect(service.criarEvolucao(createEvolucaoDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve registrar intercorrências quando houver', async () => {
      const createEvolucaoDto = {
        atendimento_id: 'atend-1',
        cliente_id: 'cliente-1',
        descricao: 'Tratamento realizado',
        intercorrencias: 'Pequena reação alérgica ao produto',
        proxima_procedimento: 'Acompanhamento',
        data_evolucao: new Date(),
      };

      mockPrismaService.evolucao.create.mockResolvedValue({
        id: 'evol-1',
        ...createEvolucaoDto,
      });

      const result = await service.criarEvolucao(createEvolucaoDto);

      expect(result.intercorrencias).toBe('Pequena reação alérgica ao produto');
    });
  });

  describe('historico de evoluções', () => {
    it('deve retornar histórico completo de evoluções do cliente', async () => {
      const evolucoes = [
        {
          id: 'evol-1',
          cliente_id: 'cliente-1',
          descricao: 'Primeira sessão',
          data_evolucao: new Date('2024-04-01'),
        },
        {
          id: 'evol-2',
          cliente_id: 'cliente-1',
          descricao: 'Segunda sessão',
          data_evolucao: new Date('2024-04-08'),
        },
      ];

      mockPrismaService.evolucao.findMany.mockResolvedValue(evolucoes);

      const result = await service.getHistoricoEvolucoes('cliente-1');

      expect(result).toHaveLength(2);
      expect(result[0].data_evolucao).toEqual(evolucoes[0].data_evolucao);
    });

    it('deve retornar evolução mais recente primeiro', async () => {
      const evolucoes = [
        {
          id: 'evol-2',
          descricao: 'Última sessão',
          data_evolucao: new Date('2024-04-15'),
        },
        {
          id: 'evol-1',
          descricao: 'Primeira sessão',
          data_evolucao: new Date('2024-04-01'),
        },
      ];

      mockPrismaService.evolucao.findMany.mockResolvedValue(evolucoes);

      const result = await service.getHistoricoEvolucoes('cliente-1');

      expect(result[0].data_evolucao).toBeGreaterThan(result[1].data_evolucao);
    });
  });

  describe('termos e consentimento', () => {
    it('deve registrar assinatura de termo de consentimento', async () => {
      const createTermoDto = {
        cliente_id: 'cliente-1',
        tipo_termo: 'CONSENTIMENTO_PROCEDIMENTO',
        conteudo_termo: 'Autorizo o procedimento de limpeza profunda...',
        assinado_em: new Date(),
        assinatura_digital: 'assinatura_base64_aqui',
      };

      const termoCriado = {
        id: 'termo-1',
        ...createTermoDto,
        status: 'ASSINADO',
      };

      mockPrismaService.termo.create.mockResolvedValue(termoCriado);

      const result = await service.criarTermo(createTermoDto);

      expect(result).toEqual(termoCriado);
      expect(result.status).toBe('ASSINADO');
    });

    it('deve validar que assinatura_digital é obrigatória', async () => {
      const createTermoDto = {
        cliente_id: 'cliente-1',
        tipo_termo: 'CONSENTIMENTO_PROCEDIMENTO',
        conteudo_termo: 'Conteúdo do termo',
        assinado_em: new Date(),
        assinatura_digital: '',
      };

      await expect(service.criarTermo(createTermoDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve retornar histórico de termos assinados por cliente', async () => {
      const termos = [
        {
          id: 'termo-1',
          tipo_termo: 'CONSENTIMENTO_PROCEDIMENTO',
          status: 'ASSINADO',
          assinado_em: new Date('2024-04-01'),
        },
      ];

      mockPrismaService.termo.findMany.mockResolvedValue(termos);

      const result = await service.getTermosAssinados('cliente-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('ASSINADO');
    });
  });

  describe('fotos e anexos', () => {
    it('deve permitir adicionar fotos durante evolução', async () => {
      const createEvolucaoDto = {
        atendimento_id: 'atend-1',
        cliente_id: 'cliente-1',
        descricao: 'Resultado do tratamento',
        intercorrencias: '',
        proxima_procedimento: '',
        data_evolucao: new Date(),
        fotos: ['foto1.jpg', 'foto2.jpg'],
      };

      mockPrismaService.evolucao.create.mockResolvedValue({
        id: 'evol-1',
        ...createEvolucaoDto,
      });

      const result = await service.criarEvolucao(createEvolucaoDto);

      expect(result.fotos).toContain('foto1.jpg');
      expect(result.fotos).toContain('foto2.jpg');
    });
  });

  describe('getAnamneseByCliente', () => {
    it('deve retornar anamnese do cliente', async () => {
      const anamnese = {
        id: 'anamnese-1',
        cliente_id: 'cliente-1',
        queixa_principal: 'Acne',
      };

      mockPrismaService.anamnese.findUnique.mockResolvedValue(anamnese);

      const result = await service.getAnamneseByCliente('cliente-1');

      expect(result).toEqual(anamnese);
    });

    it('deve lançar NotFoundException quando cliente não tem anamnese', async () => {
      mockPrismaService.anamnese.findUnique.mockResolvedValue(null);

      await expect(service.getAnamneseByCliente('cliente-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
