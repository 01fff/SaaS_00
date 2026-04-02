# REQUIREMENTS.md — Requisitos e Regras de Negócio

## Módulos Principais

| Módulo | Perfis com acesso |
|---|---|
| Autenticação e usuários | todos |
| Agenda e agendamentos | admin, recepção, profissional |
| Clientes e histórico | admin, recepção, profissional |
| Prontuário e anamnese | admin, profissional |
| Procedimentos e pacotes | admin, recepção, profissional |
| Financeiro e cobrança | admin, financeiro |
| Estoque e insumos | admin, financeiro |
| Relatórios gerenciais | admin, financeiro |
| Configurações do SaaS | admin |

---

## Requisitos Funcionais

| Código | Módulo | Descrição |
|---|---|---|
| RF01 | Agenda | Cadastrar, editar, cancelar e remarcar atendimentos sem conflito de horários por profissional. |
| RF02 | Clientes | Manter cadastro único, histórico de atendimentos, observações e anexos por cliente. |
| RF03 | Prontuário | Registrar anamnese, evolução, intercorrências, fotos e termos assinados. |
| RF04 | Pacotes | Controlar sessões contratadas, consumidas, pendentes e validade de pacotes. |
| RF05 | Financeiro | Gerar cobranças, registrar pagamentos, parcelamentos, descontos e estornos. |
| RF06 | Estoque | Controlar entrada, saída, lote, validade e baixa automática por atendimento. |
| RF07 | Relatórios | Exibir faturamento, faltas, procedimentos, comissão e consumo de estoque. |
| RF08 | Segurança | Perfis de acesso por papel (RBAC), logs de auditoria e isolamento por clínica. |
| RF09 | Multi-tenant | Onboarding de nova clínica: criar schema, executar migrations, configurar subdomínio. |

---

## Regras de Negócio Centrais

> Estas regras devem ter testes escritos **antes** de qualquer implementação (TDD).

### RN01 — Conflito de horário
```
Um profissional não pode ter dois atendimentos com horários sobrepostos.
Verificar: inicio_novo < fim_existente AND fim_novo > inicio_existente
Erro esperado: ConflictException('Profissional já possui atendimento neste horário')
```

### RN02 — Consumo de sessão de pacote
```
Sessões de pacote só são decrementadas quando o atendimento é marcado como CONCLUIDO.
Status possíveis: AGENDADO → CONCLUIDO | CANCELADO | FALTA
Erro esperado: BadRequestException('Pacote sem sessões disponíveis')
```

### RN03 — Produto vencido
```
Produto com validade anterior à data atual não pode ser associado a um atendimento.
Verificar: produto.validade >= new Date()
Erro esperado: BadRequestException('Produto com validade expirada')
```

### RN04 — Rastreabilidade de ações sensíveis
```
Ações sensíveis geram log imutável com: usuario_id, acao, entidade, entidade_id, timestamp.
Ações sensíveis: DELETE em qualquer entidade, alteração de prontuário, registro de pagamento.
```

### RN05 — Isolamento de tenant
```
Toda query ao banco deve operar exclusivamente no schema do tenant da requisição.
O schema é resolvido pelo TenantMiddleware e nunca deve vazar entre requisições.
Erro esperado: ForbiddenException se tenant não encontrado ou inativo.
```

---

## Requisitos Não Funcionais

| Categoria | Definição |
|---|---|
| Desempenho | Consultas de agenda, clientes e financeiro respondem em menos de 500ms. |
| Segurança | JWT (15min) + refresh token (7d). Bcrypt rounds: 12. Logs imutáveis. |
| Escalabilidade | Suporta crescimento de clínicas, usuários e dados sem refatoração estrutural. |
| Disponibilidade | Uptime 99,9% com backup automático diário na VPS. |
| Usabilidade | Interface intuitiva para todos os perfis sem treinamento extenso. |
| Confiabilidade | Operações críticas (pagamento, baixa de estoque) em transações ACID. |
| Manutenibilidade | Cobertura mínima de 80% no core, código modular e documentado. |
| Testabilidade | TDD em todos os services. Testes unitários, integração e E2E separados. |
