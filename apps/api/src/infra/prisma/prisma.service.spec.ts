import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService (Integração)', () => {
  let service: PrismaService;
  let client: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    client = service; // Acesso direto ao $queryRaw
  });

  afterAll(async () => {
    await service.$disconnect();
  });

  describe('connection', () => {
    it('deve conectar ao banco de dados público (schema padrão)', async () => {
      const result = await client.$queryRaw`SELECT current_schema() as schema`;

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].schema).toBeDefined();
    });
  });

  describe('setSchema', () => {
    it('deve executar SET search_path para um schema válido', async () => {
      const testSchema = 'clinica_teste';

      // Criar schema de teste
      await client.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${client.$raw(testSchema)}`;

      // Executar SET search_path
      await client.$executeRaw`SET search_path = ${client.$raw(testSchema)}`;

      // Verificar se o schema foi alterado
      const result = await client.$queryRaw`SELECT current_schema() as schema`;

      expect(result[0].schema).toBe(testSchema);

      // Limpar
      await client.$executeRaw`SET search_path = public`;
      await client.$executeRaw`DROP SCHEMA IF EXISTS ${client.$raw(testSchema)}`;
    });

    it('deve isolar dados entre schemas diferentes (RN05)', async () => {
      const schema1 = 'clinica_1';
      const schema2 = 'clinica_2';
      const tableName = 'teste_isolamento';

      // Criar schemas de teste
      await client.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${client.$raw(schema1)}`;
      await client.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${client.$raw(schema2)}`;

      // Criar tabela em schema1
      await client.$executeRaw`SET search_path = ${client.$raw(schema1)}`;
      await client.$executeRaw`
        CREATE TABLE IF NOT EXISTS ${client.$raw(tableName)} (
          id SERIAL PRIMARY KEY,
          data TEXT NOT NULL
        )
      `;
      await client.$executeRaw`INSERT INTO ${client.$raw(tableName)} (data) VALUES ('dados_schema1')`;

      // Criar tabela em schema2
      await client.$executeRaw`SET search_path = ${client.$raw(schema2)}`;
      await client.$executeRaw`
        CREATE TABLE IF NOT EXISTS ${client.$raw(tableName)} (
          id SERIAL PRIMARY KEY,
          data TEXT NOT NULL
        )
      `;
      await client.$executeRaw`INSERT INTO ${client.$raw(tableName)} (data) VALUES ('dados_schema2')`;

      // Verificar isolamento: ler de schema1
      await client.$executeRaw`SET search_path = ${client.$raw(schema1)}`;
      const result1 = await client.$queryRaw`SELECT data FROM ${client.$raw(tableName)}`;
      expect(result1[0].data).toBe('dados_schema1');

      // Verificar isolamento: ler de schema2
      await client.$executeRaw`SET search_path = ${client.$raw(schema2)}`;
      const result2 = await client.$queryRaw`SELECT data FROM ${client.$raw(tableName)}`;
      expect(result2[0].data).toBe('dados_schema2');

      // Limpar
      await client.$executeRaw`SET search_path = public`;
      await client.$executeRaw`DROP SCHEMA IF EXISTS ${client.$raw(schema1)} CASCADE`;
      await client.$executeRaw`DROP SCHEMA IF EXISTS ${client.$raw(schema2)} CASCADE`;
    });
  });

  describe('error handling', () => {
    it('deve lançar erro ao tentar acessar schema inválido', async () => {
      const invalidSchema = 'schema_nao_existe_xyz123';

      expect(async () => {
        await client.$executeRaw`SET search_path = ${client.$raw(invalidSchema)}`;
        // Se chegar aqui, tenta uma query para forçar o erro
        await client.$queryRaw`SELECT 1`;
      }).rejects.toThrow();
    });
  });

  describe('reset', () => {
    it('deve resetar para schema padrão (public)', async () => {
      // Mudar para outro schema
      const testSchema = 'clinica_temp';
      await client.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${client.$raw(testSchema)}`;
      await client.$executeRaw`SET search_path = ${client.$raw(testSchema)}`;

      // Resetar para public
      await client.$executeRaw`SET search_path = public`;

      const result = await client.$queryRaw`SELECT current_schema() as schema`;
      expect(result[0].schema).toBe('public');

      // Limpar
      await client.$executeRaw`DROP SCHEMA IF EXISTS ${client.$raw(testSchema)}`;
    });
  });
});
