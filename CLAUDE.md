# CLAUDE.md — Instruções para o Claude Code

Este arquivo é lido automaticamente pelo Claude Code ao iniciar qualquer sessão.
Siga todas as instruções abaixo sem exceção.

---

## Regra principal — confirmação obrigatória

> **Antes de criar, editar ou deletar qualquer arquivo, sempre pergunte ao usuário e aguarde confirmação explícita.**

Isso inclui: arquivos de código, arquivos de configuração, arquivos de teste, arquivos `.env`, `package.json`, `docker-compose.yml` e qualquer outro. Nunca aja de forma autônoma na criação ou modificação de arquivos.

---

## Metodologia — TDD obrigatório

Este projeto usa **Test-Driven Development (TDD)** em todos os módulos de negócio.
O ciclo é sempre: **Red → Green → Refactor**.

### Regras invioláveis de TDD

1. **Nunca implemente um service ou regra de negócio sem um teste escrito antes.**
2. A sequência obrigatória para qualquer nova funcionalidade é:
   - Escrever o arquivo `.spec.ts` com os casos de teste (Red)
   - Pedir confirmação antes de criar o arquivo
   - Implementar o mínimo de código para passar nos testes (Green)
   - Pedir confirmação antes de criar o arquivo
   - Refatorar mantendo os testes passando (Refactor)
   - Pedir confirmação antes de modificar qualquer arquivo
3. **Nunca escreva implementação e teste ao mesmo tempo no mesmo passo.**
4. Se o usuário pedir para implementar algo sem teste, lembre-o da metodologia TDD e proponha escrever o teste primeiro.

### Estrutura de teste por camada

```
Unitário     → services e regras de negócio (Jest + mocks)
Integração   → repositories com banco real (Jest + Prisma + DB de teste)
E2E          → fluxos HTTP completos (Supertest)
Frontend     → componentes e interações (React Testing Library)
```

### Cobertura mínima

- Core (services, guards, middleware): **80%**
- Módulos de negócio: **70%**

---

## Arquitetura — decisões já tomadas (não reverter)

| Decisão | Definição |
|---|---|
| Multi-tenant | Schema separado por clínica no PostgreSQL (nunca tenant_id em tabela) |
| Backend | NestJS + TypeScript (strict: true) |
| Frontend | Next.js com App Router |
| ORM | Prisma |
| Banco | PostgreSQL |
| Cache e filas | Redis + BullMQ |
| Arquivos | Cloudflare R2 |
| Infra | Hostinger VPS com Nginx + PM2 + Let's Encrypt |

---

## Isolamento de tenant — regra crítica de segurança

- Toda requisição passa por `TenantMiddleware` antes de qualquer controller.
- O `PrismaService` executa `SET search_path = <schema>` a cada conexão.
- **Nunca exponha dados de um tenant no contexto de outro tenant.**
- Nenhum módulo de negócio deve conhecer detalhes de multi-tenancy diretamente.

### Pipeline obrigatório de toda requisição

```
Request HTTP
  ↓
  TenantMiddleware   → resolve schema pelo subdomínio
  ↓
  AuthGuard          → valida JWT, popula req.user
  ↓
  RolesGuard         → verifica perfil (RBAC)
  ↓
  Controller → Service → PrismaService
```

---

## Estrutura de pastas — siga estritamente

```
saas-clinica/
├── apps/
│   ├── api/                        ← NestJS
│   │   └── src/
│   │       ├── infra/
│   │       │   ├── tenant/         ← TenantMiddleware + TenantService
│   │       │   ├── prisma/         ← PrismaService com search_path
│   │       │   ├── auth/           ← AuthGuard + RolesGuard + decorators
│   │       │   └── storage/        ← Cloudflare R2
│   │       └── modules/
│   │           ├── agenda/
│   │           ├── clientes/
│   │           ├── prontuario/
│   │           ├── financeiro/
│   │           ├── estoque/
│   │           └── relatorios/
│   └── web/                        ← Next.js
│       └── app/
│           ├── (auth)/
│           └── (dashboard)/
├── packages/
│   ├── types/                      ← DTOs e interfaces compartilhadas
│   └── utils/
├── prisma/
│   ├── schema.prisma               ← schema público (tenants, planos)
│   └── tenant-schema.prisma        ← schema de cada clínica
├── docs/                           ← documentação do projeto
└── docker-compose.yml              ← PostgreSQL + Redis local
```

---

## Convenções de código

### Idioma
- **Português**: nomes de domínio (`clientes`, `agendamentos`, `prontuarios`)
- **Inglês**: infraestrutura (`TenantService`, `AuthGuard`, `PrismaModule`)

### Commits (Conventional Commits)
```
feat:   nova funcionalidade
fix:    correção de bug
test:   adição ou correção de testes
chore:  configuração, dependências, infra
docs:   documentação
```

### TypeScript
- `strict: true` em todos os projetos
- Sem `any` explícito — use tipos precisos ou `unknown`
- DTOs sempre validados com `class-validator`

---

## Como iniciar uma nova funcionalidade (checklist TDD)

```
[ ] 1. Entender o requisito e a regra de negócio correspondente (ver REQUIREMENTS.md)
[ ] 2. Perguntar ao usuário se pode criar o arquivo .spec.ts
[ ] 3. Escrever os casos de teste (cenário feliz + cenários de erro)
[ ] 4. Rodar os testes — devem FALHAR (Red)
[ ] 5. Perguntar ao usuário se pode criar o arquivo de implementação
[ ] 6. Implementar o mínimo para passar nos testes (Green)
[ ] 7. Rodar os testes — devem PASSAR
[ ] 8. Perguntar ao usuário se pode refatorar
[ ] 9. Refatorar mantendo testes verdes (Refactor)
[ ] 10. Commitar: test: + feat: em commits separados
```

---

## Referências

- Arquitetura detalhada: `docs/ARCHITECTURE.md`
- Requisitos e regras de negócio: `docs/REQUIREMENTS.md`
- Planejamento e etapas: `docs/PLANNING.md`

## Regras de revisão e escopo
- Para o Claude Code
- Implemente apenas o que foi solicitado no passo atual
- Não adicione arquivos, campos, índices, configurações ou otimizações além do escopo pedido
- Não antecipe problemas futuros — deixe o TDD revelar o que é necessário
- Se perceber algo que pode ser necessário no futuro, mencione como observação mas não implemente
- Cada passo termina quando os testes do passo atual estão passando, não antes, não depois