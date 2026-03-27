# SaaS Clínica Estética

Sistema de gestão para clínicas de estética em modelo SaaS multi-tenant.

> Projeto pessoal desenvolvido com foco em aprendizado (build to learn).
> Stack: NestJS + Next.js + PostgreSQL + Prisma + Redis.

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Instruções para o Claude Code — lido automaticamente |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, multi-tenant, pipeline de requisição, deploy |
| [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md) | Requisitos funcionais e regras de negócio |
| [`docs/PLANNING.md`](./docs/PLANNING.md) | Etapas, TDD, convenções de código e commits |

---

## Desenvolvimento local

```bash
# Subir banco e cache
docker-compose up -d

# API (NestJS)
cd apps/api && npm install && npm run start:dev

# Frontend (Next.js)
cd apps/web && npm install && npm run dev
```

---

## Metodologia

Este projeto segue **TDD (Test-Driven Development)** em todos os módulos de negócio.
Nenhum service é implementado sem um teste escrito antes.

Ciclo: **Red → Green → Refactor**

---

## Status

- [ ] Etapa 1 — Infraestrutura e isolamento de tenant
- [ ] Etapa 2 — Autenticação e governança
- [ ] Etapa 3 — MVP de negócio
- [ ] Etapa 4 — Evolução funcional
- [ ] Etapa 5 — Escala SaaS
