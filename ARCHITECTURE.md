# ARCHITECTURE.md — Arquitetura Técnica

## Stack Tecnológica

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Frontend | Next.js (App Router) | Interface por perfil de acesso, SSR |
| Backend | NestJS + TypeScript | API REST, guards, middleware de tenant |
| ORM | Prisma | Troca de schema por tenant, migrations |
| Banco de dados | PostgreSQL | Schemas isolados por clínica |
| Cache / Filas | Redis + BullMQ | Cache de sessões, jobs assíncronos |
| Arquivos | Cloudflare R2 | Fotos, PDFs, termos e anexos |
| Proxy / SSL | Nginx + Let's Encrypt | Reverse proxy, HTTPS, subdomínios |
| Processos | PM2 | Gerência de processos Node.js na VPS |
| Infraestrutura | Hostinger VPS (Brasil) | Servidor Linux, NVMe, IP fixo |

---

## Estratégia Multi-Tenant

Cada clínica é identificada por um subdomínio próprio.

```
clinicaabc.seuapp.com  →  schema: clinica_abc
clinicaxyz.seuapp.com  →  schema: clinica_xyz
```

O `TenantMiddleware` intercepta toda requisição, resolve o `schema_name` na tabela
`public.tenants` e o injeta no contexto. O `PrismaService` executa
`SET search_path = <schema>` a cada conexão — nenhum módulo de negócio
precisa conhecer detalhes de multi-tenancy.

---

## Divisão de Schemas no Banco

### Schema público (`public`)
Contém apenas dados globais do SaaS:
- `tenants` — registro de cada clínica (slug, schema_name, plano, status)
- `planos` — planos de assinatura disponíveis
- `faturamento_saas` — cobranças por clínica

### Schema por clínica (`clinica_xxx`)
Criado no onboarding de cada clínica. Contém:
- `usuarios` — usuários e perfis de acesso
- `clientes` — cadastro e histórico
- `agendamentos` — agenda e procedimentos
- `pacotes` — pacotes e sessões contratadas
- `prontuarios` — anamnese, evolução, fotos, termos
- `financeiro` — cobranças, pagamentos, comissões
- `estoque` — insumos, lotes, validade

---

## Pipeline de Requisição (NestJS)

```
Request HTTP
  ↓
  TenantMiddleware   → lê subdomínio → busca public.tenants → injeta schema
  ↓
  AuthGuard          → valida JWT → popula req.user
  ↓
  RolesGuard         → verifica perfil via @Roles() decorator
  ↓
  Controller         → recebe DTOs validados
  ↓
  Service            → regras de negócio (testadas via TDD)
  ↓
  PrismaService      → executa query no schema correto
```

---

## Autenticação e Autorização

- **JWT** com access token (15min) + refresh token (7 dias)
- Senhas com **bcrypt** (rounds: 12)
- **RBAC** via `@Roles()` decorator + `RolesGuard`
- Perfis: `admin`, `recepcao`, `profissional`, `financeiro`
- Logs de auditoria imutáveis para ações sensíveis

---

## PrismaService — troca de schema

```typescript
// Exemplo do comportamento esperado do PrismaService
async withTenant<T>(schema: string, fn: () => Promise<T>): Promise<T> {
  await this.$executeRawUnsafe(`SET search_path = "${schema}"`);
  return fn();
}
```

Cada módulo de negócio usa o `PrismaService` normalmente — a troca de schema
é transparente e acontece antes de qualquer operação.

---

## Deploy na Hostinger VPS

```
GitHub (main)
  ↓ GitHub Actions
  SSH na VPS
  ↓
  git pull + npm run build
  ↓
  pm2 reload all
  ↓
  Nginx (porta 443) → Next.js (3000) + NestJS (4000)
```

### Processos PM2
```
saas-api   → NestJS  (porta 4000)
saas-web   → Next.js (porta 3000)
```

### Nginx — roteamento por subdomínio
```nginx
# Toda clínica cai no mesmo servidor
server_name *.seuapp.com;

location /api { proxy_pass http://localhost:4000; }
location /    { proxy_pass http://localhost:3000; }
```
