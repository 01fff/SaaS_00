import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await service.$disconnect();
  });

  describe('connection', () => {
    it('deve estar pronto para aceitar conexões', () => {
      expect(service).toBeDefined();
    });
  });

  describe('methods', () => {
    it('deve ter método withTenant definido', () => {
      expect(service.withTenant).toBeDefined();
      expect(typeof service.withTenant).toBe('function');
    });
  });

  describe('withTenant', () => {
    it('deve executar SET search_path e retornar resultado da função', async () => {
      jest
        .spyOn(service, '$executeRawUnsafe')
        .mockResolvedValue(undefined as never);
      const mockFn = jest.fn().mockResolvedValue('resultado');

      const result = await service.withTenant('clinica_abc', mockFn);

      expect(service.$executeRawUnsafe).toHaveBeenCalledWith(
        'SET search_path = "clinica_abc"',
      );
      expect(result).toBe('resultado');
      expect(mockFn).toHaveBeenCalled();
    });

    it('deve retornar o resultado da função executada no schema correto', async () => {
      const mockData = { id: 'uuid-1', nome: 'Dados' };
      jest
        .spyOn(service, '$executeRawUnsafe')
        .mockResolvedValue(undefined as never);
      const mockFn = jest.fn().mockResolvedValue(mockData);

      const result = await service.withTenant('clinica_xyz', mockFn);

      expect(service.$executeRawUnsafe).toHaveBeenCalledWith(
        'SET search_path = "clinica_xyz"',
      );
      expect(result).toEqual(mockData);
    });
  });

  // Testes de integração com banco real (RN05 — isolamento de schema)
  // Requerem PostgreSQL rodando: docker-compose up -d
  describe.skip('setSchema (integração)', () => {
    it('deve executar SET search_path para um schema válido', async () => {
      const testSchema = 'clinica_teste';
      await service.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS ${testSchema}`,
      );
      await service.$executeRawUnsafe(`SET search_path = "${testSchema}"`);
      const result =
        await service.$queryRaw<{ schema: string }[]>`SELECT current_schema() as schema`;
      expect(result[0].schema).toBe(testSchema);
      await service.$executeRawUnsafe('SET search_path = public');
      await service.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS ${testSchema}`,
      );
    });

    it('deve isolar dados entre schemas diferentes (RN05)', async () => {
      const schema1 = 'clinica_1';
      const schema2 = 'clinica_2';
      const tableName = 'teste_isolamento';
      await service.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${schema1}`);
      await service.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${schema2}`);
      await service.$executeRawUnsafe(`SET search_path = "${schema1}"`);
      await service.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS ${tableName} (id SERIAL PRIMARY KEY, data TEXT NOT NULL)`,
      );
      await service.$executeRawUnsafe(
        `INSERT INTO ${tableName} (data) VALUES ('dados_schema1')`,
      );
      await service.$executeRawUnsafe(`SET search_path = "${schema2}"`);
      await service.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS ${tableName} (id SERIAL PRIMARY KEY, data TEXT NOT NULL)`,
      );
      await service.$executeRawUnsafe(
        `INSERT INTO ${tableName} (data) VALUES ('dados_schema2')`,
      );
      await service.$executeRawUnsafe(`SET search_path = "${schema1}"`);
      const result1 =
        await service.$queryRaw<{ data: string }[]>`SELECT data FROM teste_isolamento`;
      expect(result1[0].data).toBe('dados_schema1');
      await service.$executeRawUnsafe(`SET search_path = "${schema2}"`);
      const result2 =
        await service.$queryRaw<{ data: string }[]>`SELECT data FROM teste_isolamento`;
      expect(result2[0].data).toBe('dados_schema2');
      await service.$executeRawUnsafe('SET search_path = public');
      await service.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema1} CASCADE`);
      await service.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema2} CASCADE`);
    });
  });

  describe.skip('reset (integração)', () => {
    it('deve resetar para schema padrão (public)', async () => {
      const testSchema = 'clinica_temp';
      await service.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS ${testSchema}`,
      );
      await service.$executeRawUnsafe(`SET search_path = "${testSchema}"`);
      await service.$executeRawUnsafe('SET search_path = public');
      const result =
        await service.$queryRaw<{ schema: string }[]>`SELECT current_schema() as schema`;
      expect(result[0].schema).toBe('public');
      await service.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${testSchema}`);
    });
  });
});
