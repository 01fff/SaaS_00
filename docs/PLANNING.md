# PLANNING.md — Planejamento e Ordem de Implementação

## Etapas do Projeto

### Etapa 1 — Infraestrutura e Isolamento (começar aqui)

> Objetivo: sistema rodando localmente com isolamento de tenant funcionando.

```
[ ] docker-compose.yml com PostgreSQL + Redis
[ ] prisma/schema.prisma — schema público: tabela tenants
[ ] TenantService — TDD antes da implementação
    [ ] spec: deve retornar tenant pelo slug
    [ ] spec: deve lançar erro se tenant não encontrado
    [ ] spec: deve lançar erro se tenant inativo
[ ] TenantMiddleware — injeta schema no contexto da requisição
[ ] PrismaService — executa SET search_path por tenant
[ ] Teste de integração: requisição com subdomínio válido → query no schema correto
```

### Etapa 2 — Autenticação e Governança

> Objetivo: sistema com login, perfis e controle de acesso funcionando.

```
[ ] prisma/tenant-schema.prisma — tabela usuarios com enum de perfis
[ ] AuthService — TDD antes da implementação
    [ ] spec: deve gerar access token e refresh token no login
    [ ] spec: deve rejeitar senha incorreta
    [ ] spec: deve rejeitar usuário inexistente
    [ ] spec: deve renovar access token com refresh token válido
[ ] AuthGuard — valida JWT e popula req.user
[ ] RolesGuard + decorator @Roles()
    [ ] spec: deve permitir acesso ao perfil correto
    [ ] spec: deve negar acesso ao perfil incorreto
```

### Etapa 3 — MVP de Negócio

> Objetivo: fluxo principal da clínica funcionando (agendamento → atendimento → cobrança).

```
[ ] Módulo clientes (CRUD + histórico)
[ ] Módulo agenda
    [ ] spec: RN01 — conflito de horário
    [ ] spec: deve criar agendamento em horário livre
[ ] Módulo procedimentos e pacotes
    [ ] spec: RN02 — consumo de sessão apenas ao concluir
    [ ] spec: deve rejeitar agendamento sem sessões disponíveis
[ ] Módulo prontuário (anamnese + evolução + fotos)
[ ] Módulo financeiro (cobranças + pagamentos)
[ ] Frontend Next.js: telas de agenda, clientes e dashboard inicial
```

### Etapa 4 — Evolução Funcional

```
[ ] Estoque com baixa automática por atendimento (RN03 — produto vencido)
[ ] Relatórios gerenciais com agregações e exportação
[ ] Multiunidade: suporte a mais de uma unidade por tenant
[ ] Logs de auditoria (RN04 — rastreabilidade)
```

### Etapa 5 — Escala SaaS

```
[ ] Onboarding automatizado: criar schema + executar migrations
[ ] Gestão de planos de assinatura e faturamento SaaS
[ ] Observabilidade: logs estruturados + alertas
[ ] CI/CD com GitHub Actions + deploy automático na Hostinger VPS
```

---

## Estratégia de Testes (TDD)

### Ciclo obrigatório para cada funcionalidade

```
1. Escrever .spec.ts com todos os casos (Red)
   → pedir confirmação antes de criar o arquivo

2. Rodar os testes → devem FALHAR
   → confirmar que está no estado Red

3. Implementar o mínimo para passar (Green)
   → pedir confirmação antes de criar o arquivo de implementação

4. Rodar os testes → devem PASSAR
   → confirmar que está no estado Green

5. Refatorar sem quebrar testes (Refactor)
   → pedir confirmação antes de qualquer modificação

6. Commitar em dois commits separados:
   → test: adiciona testes para [funcionalidade]
   → feat: implementa [funcionalidade]
```

### Tipos de teste e quando usar cada um

| Tipo | Quando usar | Ferramenta | Onde fica |
|---|---|---|---|
| Unitário | Services, guards, regras de negócio | Jest + mocks | `*.spec.ts` ao lado do arquivo |
| Integração | Repositories, fluxos com banco | Jest + Prisma + DB teste | `*.integration.spec.ts` |
| E2E | Fluxos HTTP completos | Supertest | `test/*.e2e-spec.ts` |
| Frontend | Componentes e interações | React Testing Library | `*.test.tsx` |

### Configuração de cobertura (jest.config.ts)

```typescript
coverageThreshold: {
  './src/infra/**': { lines: 80, functions: 80 },
  './src/modules/**': { lines: 70, functions: 70 },
}
```

---

## Convenções do Projeto

### Idioma
- **Português**: entidades de domínio (`clientes`, `agendamentos`, `prontuarios`)
- **Inglês**: infraestrutura e código (`TenantService`, `AuthGuard`, `PrismaModule`)

### Commits (Conventional Commits)
| Prefixo | Quando usar |
|---|---|
| `feat:` | nova funcionalidade |
| `fix:` | correção de bug |
| `test:` | adição ou correção de testes |
| `chore:` | configuração, dependências |
| `docs:` | documentação |
| `refactor:` | refatoração sem mudança de comportamento |

### Regras de PR
- Toda PR deve ter testes passando antes do merge
- Toda PR deve incluir ao menos um teste novo ou atualizado
- Commits de `test:` devem vir antes dos commits de `feat:` correspondentes
