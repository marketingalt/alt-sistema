# Análise Jobs-to-be-Done — Alt Orçamentos

## Personas

### Persona 1: Thiemy (Admin / Dono do Negócio)

| Atributo | Detalhe |
|---|---|
| **Cargo** | Admin / Proprietário |
| **Nível técnico** | Intermediário — confortável com sistemas web, sem background em ERPs tradicionais |
| **Dispositivo** | Desktop (tela grande) |
| **Contexto de uso** | Foco profundo, horário comercial, gerindo múltiplos contratos e projetos |
| **Frequência** | Diária — navega entre orçamentos, finanças, planejamento |
| **Métrica de sucesso** | Reduzir tempo entre criar orçamento → aprovar → gerar OS → pagar fornecedor |

### Persona 2: Financeiro (Responsável pelo Departamento Financeiro)

| Atributo | Detalhe |
|---|---|
| **Cargo** | Analista Financeiro / Contas a Pagar |
| **Nível técnico** | Básico a intermediário — confortável com interfaces web, mas precisa de simplicidade |
| **Dispositivo** | Desktop (tela grande) |
| **Contexto de uso** | Múltiplas abas abertas, foco em organização e não errar valores/prazos |
| **Frequência** | Diária (lançamentos, pagamentos, conciliação) |
| **Métrica de sucesso** | Zero contas vencidas por erro de lançamento, conciliação rápida |

---

## Job Statement #1 — Gestão de Orçamentos

> **Quando** recebo uma solicitação de orçamento de um cliente,
> **quero** montar a proposta com itens, fornecedores, margens e prazos em um fluxo contínuo,
> **para** que o cliente receba uma proposta profissional e eu saiba exatamente o lucro de cada item.

### Solução Atual & Dores
- **Atual**: O sistema já tem a tela de orçamento com itens, fornecedores, margens
- **Dor**: Precisaria ter mais agilidade — talvez buscas mais rápidas de produtos, preenchimento automático de dados de fornecedor
- **Oportunidade**: Reduzir o número de cliques entre criar → precificar → enviar

### Critérios de Sucesso
- Orçamento completo em < 5 minutos para itens conhecidos
- Margem calculada automaticamente sem revisão manual
- Um clique para converter orçamento em OS + contas a pagar/receber

---

## Job Statement #2 — Controle de Contas a Pagar

> **Quando** uma despesa recorrente vence (aluguel, assinatura, salário, fornecedor),
> **quero** que o sistema gere as parcelas automaticamente e me avise,
> **para** que eu nunca perca um prazo e não precise copiar manualmente a mesma conta todo mês.

### Solução Atual & Dores
- **Atual**: Recorrência com predefinições (mensal/quinzenal/semanal/anual) + personalizado
- **Dor** (confirmada):
  - "Esqueço de gerar a próxima parcela" → contas vencem sem lançamento
  - "Perco tempo copiando a mesma conta manualmente" → retrabalho manual
- **Oportunidade**: Recorrência inteligente que já cria as próximas parcelas com notificação

### Critérios de Sucesso
- Zero contas vencidas por esquecimento
- Um cadastro único para contas recorrentes
- Visibilidade clara do fluxo de caixa futuro

---

## Job Statement #3 — Conciliação Financeira (Receber + Pagar)

> **Quando** fecho o mês,
> **quero** ver tudo que entrei (receber) e tudo que saiu (pagar) em um só lugar,
> **para** ter certeza de que o negócio está saudável e tomar decisões sem sustos.

### Solução Atual & Dores
- **Atual**: Módulos separados de contas a pagar, contas a receber, fluxo de caixa
- **Dor**: Precisa navegar entre várias telas para ter a visão completa; risco de perder um lançamento
- **Oportunidade**: Dashboard unificado que cruza contas a pagar + receber em uma timeline

### Critérios de Sucesso
- Visão consolidada do fluxo de caixa em uma única tela
- Previsão de saldo para os próximos 30/60/90 dias
- Alertas de saldo negativo futuro

---

## Job Statement #4 — Operação (Orçamento → OS → Pagamento)

> **Quando** um orçamento é aprovado,
> **quero** que ele se desdobre automaticamente em Ordem de Serviço, contas a pagar (fornecedores) e contas a receber (cliente),
> **para** que a operação inteira seja rastreada sem retrabalho e sem erros de digitação.

### Solução Atual & Dores
- **Atual**: Orçamento é criado, depois precisa criar OS manual, contas a pagar/receber separadamente
- **Dor**: Dados precisam ser redigitados ou copiados entre módulos — risco de erro e retrabalho
- **Oportunidade**: Fluxo integrado "Orçamento Aprovado → OS → Contas" com um clique

### Critérios de Sucesso
- OS gerada automaticamente ao aprovar orçamento
- Contas a pagar (fornecedores) lançadas automaticamente
- Contas a receber (cliente) lançada automaticamente
- Rastreabilidade completa de ponta a ponta

---

## Mapa de Oportunidades Prioritárias

| Prioridade | Job | Oportunidade | Impacto | Esforço |
|---|---|---|---|---|
| 🔴 P0 | #2 — Contas a Pagar (Recorrência) | Gerar parcelas automaticamente com notificação | 🟢 Alto | 🟢 Baixo |
| 🔴 P0 | #1 — Orçamentos | Agilidade na montagem da proposta | 🟢 Alto | 🟡 Médio |
| 🟡 P1 | #3 — Conciliação Financeira | Dashboard unificado pagar + receber | 🟢 Alto | 🔴 Alto |
| 🟡 P1 | #4 — Operação Integrada | Fluxo automático orçamento → OS → contas | 🟢 Alto | 🔴 Alto |

---

## Notas para o Time de Design

- **Persona principal para validação de UX**: Financeiro — é quem mais usa o dia a dia e sente as dores operacionais. Thiemy (admin) valida decisões estratégicas mas vive no alto nível.
- **Desktop-first**: Ambos usam desktop com tela grande. Não priorizar mobile agora.
- **Simplicidade > Potência**: Usuários não vêm de ERPs complexos — preferem interfaces limpas com o essencial visível.
