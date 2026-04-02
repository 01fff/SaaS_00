-- Criar schema public se não existir
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissões ao usuário
GRANT ALL PRIVILEGES ON SCHEMA public TO clinica_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO clinica_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO clinica_user;

-- Criar extensão uuid-ossp se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela de tenants (schema público)
CREATE TABLE IF NOT EXISTS public.tenant (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(63) UNIQUE NOT NULL,
  schema_name VARCHAR(63) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ATIVO', 'INATIVO', 'SUSPENSO')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissões para usuário na tabela tenant
GRANT ALL PRIVILEGES ON TABLE public.tenant TO clinica_user;
GRANT USAGE, SELECT ON SEQUENCE public.tenant_id_seq TO clinica_user;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_tenant_slug ON public.tenant(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_status ON public.tenant(status);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO clinica_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO clinica_user;
