# Especificação de Fluxo para Figma — Alt Orçamentos

## Fluxo Principal: Gestão de Contas a Pagar

**Ponto de Entrada**: Sidebar → Financeiro → Contas a Pagar

---

### Tela 1: Lista de Contas a Pagar

**Layout**: Tabela com cards expansíveis (no mobile) ou linhas de tabela (desktop)

**Elementos da Tela**:

```
┌─────────────────────────────────────────────────────────────┐
│ [Filtros: ▼ Status ▼ Categoria ▼ Período]    [+ Nova Conta] │
├─────────────────────────────────────────────────────────────┤
│  Vencimento  │ Fornecedor     │ Categoria    │ Valor   │Stt │
│──────────────┼────────────────┼──────────────┼─────────┼────│
│  📅 22/07    │ C6 Bank        │ Desp. Adm    │ R$ 4.800│ 🔴 │
│    └ ↻ mensal (12/12)                                       │
│──────────────┼────────────────┼──────────────┼─────────┼────│
│  📅 25/07    │ Escritório XYZ │ Serviço      │ R$ 2.000│ 🟡 │
│──────────────┼────────────────┼──────────────┼─────────┼────│
│              │                │              │         │    │
│              │                │  TOTAL: R$ 6.800           │
└─────────────────────────────────────────────────────────────┘
```

**Estados**:
| Estado | Comportamento |
|---|---|
| ✅ **Normal** | Lista com todas as contas, filtros padrão (mês atual) |
| 🔄 **Loading** | Skeleton loader com 5 linhas pulsando |
| ❌ **Empty** | Ilustração + "Nenhuma conta ainda" + botão "Criar primeira conta" |
| ⚠️ **Erro** | Banner: "Erro ao carregar contas. [Tentar novamente]" |
| 🔍 **Filtro ativo** | Badge acima da tabela: "Filtrado por: Status: Pendente, Categoria: Serviço [Limpar]" |

**Interações**:
- **Clique na linha**: Abre drawer de detalhes (lado direito)
- **Clique no fornecedor**: Abre card do fornecedor
- **Badge ↻**: Identifica contas recorrentes com tooltip "12 de 12 parcelas geradas"
- **Status colorido**: 🟢 Pago / 🟡 Pendente / 🔴 Vencido / ⚫ Cancelado

**Acessibilidade**:
- [x] Tabela com `<th>` e escopo adequado
- [x] Linhas alternadas (zebra) opcionais
- [x] Badge de recorrência com tooltip acessível
- [x] Atalho de teclado: `n` para nova conta

---

### Tela 2: Modal — Nova Conta

**Layout**: Drawer lateral direita (full-height, ~500px de largura)

**Elementos do Modal**:

```
┌──────────────────────────────────────┐
│ ✕ Nova Conta                     │
├──────────────────────────────────────┤
│                                      │
│  Vencimento*  [📅 __/__/____]       │
│                                      │
│  Fornecedor   [🔍 ...]  [+ Novo]    │
│                                      │
│  Descrição*   [________________]     │
│                                      │
│  Valor*       [R$ ___________]       │
│                                      │
│  Modalidade   [▼ PIX ▼]             │
│                                      │
│  Banco        [▼ C6 BANK ▼]         │
│                                      │
│  Área         [▼ MISTO ▼]           │
│                                      │
│  Categoria    [▼ Desp. Adm ▼] [⚙]   │
│                                      │
│  Obs          [________________]     │
│                                      │
│  ┌─ Recorrência ─────────────────┐  │
│  │ [Toggle] Conta recorrente     │  │
│  │                                │  │
│  │  [Mensal] [Quinz] [Semanal]   │  │
│  │  [Anual] [⋮ Personalizar]     │  │
│  │                                │  │
│  │  ou (se personalizado):       │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ A cada 45 dia(s)        │  │  │
│  │  │ 6 parcelas · personaliz.│  │  │
│  │  │ [✏ Editar]             │  │  │
│  │  └─────────────────────────┘  │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  [Cancelar]     [Salvar Conta]      │
└──────────────────────────────────────┘
```

**Estados do campo Valor**:
- **Vazio**: Placeholder "R$ 0,00"
- **Preenchendo**: Máscara de moeda brasileira (R$ 1.234,56)
- **Zero**: Texto "A confirmar" ao salvar (valor será definido depois)

**Estados do Toggle Recorrência**:
- **OFF**: Label "Conta recorrente" cinza, sem opções abaixo
- **ON**: Label laranja, opções de periodicidade aparecem com animação
- **Personalizado**: Card substitui opções predefinidas, com botão "✏ Editar"

**Validação**:
| Campo | Regra | Erro |
|---|---|---|
| Vencimento | Obrigatório | "Informe a data de vencimento" |
| Descrição | Obrigatório (mín 3 caracteres) | "Informe a descrição da conta" |
| Valor | ≥ 0 (0 = "A confirmar") | — |
| Recorrência | Se ativo, precisa ter periodicidade | — |
| Recorrência Person. | Dias da semana obrigatório se "Semanas" | "Selecione ao menos um dia" |

---

### Tela 3: Modal — Recorrência Personalizada

**Layout**: Modal central (max-w-sm, ~400px)

**Elementos do Modal**:

```
┌──────────────────────────────────────────┐
│  Recorrência personalizada           ✕  │
├──────────────────────────────────────────┤
│                                          │
│  Repetir a cada:                         │
│  ┌────┐ ┌──────────────────────────────┐ │
│  │  1 │ │ ▼ Semanas                    │ │
│  │  ▲ │ └──────────────────────────────┘ │
│  │  ▼ │                                   │
│  └────┘                                   │
│                                          │
│  Repetir: (aparece só se "Semanas")      │
│  [D] [S] [T] [Q] [Q] [S] [S]            │
│   ○   ○   ●   ○   ○   ○   ○             │
│                                          │
│  Termina em                              │
│  ○ Nunca                                 │
│                                          │
│  ○ Em     [📅 __/__/____]               │
│                                          │
│  ○ Após   [___] ocorrências              │
│                                          │
├──────────────────────────────────────────┤
│  [Cancelar]          [Concluir]          │
└──────────────────────────────────────────┘
```

**Estados**:
| Elemento | Estado | Visual |
|---|---|---|
| **Dias da semana** | Não selecionado | Fundo cinza claro, texto escuro |
| **Dias da semana** | Selecionado | Fundo escuro (gray-900), texto branco |
| **Radio "Nunca"** | Selecionado (padrão) | Bolinha preta preenchida |
| **Radio "Em"** | Desabilitado (não selecionado) | Input date em cinza, cursor not-allowed |
| **Radio "Em"** | Selecionado | Input date habilitado, foco laranja |
| **Radio "Após"** | Desabilitado (não selecionado) | Input numérico em cinza |
| **Radio "Após"** | Selecionado | Input habilitado com label "ocorrências" |

**Validação**:
| Condição | Erro |
|---|---|
| Intervalo < 1 | "O intervalo mínimo é 1." |
| Semana selecionada + nenhum dia marcado | "Selecione ao menos um dia da semana." |
| "Em" selecionado + sem data | "Informe a data de término." |
| "Após" selecionado + ocorrências < 1 | "Informe o número de ocorrências (mínimo 1)." |

**Animações sugeridas para Figma**:
- Abertura: Fade + scale (0.95 → 1.0) com backdrop escurecendo
- Dias da semana aparecendo: Deslizam suave de cima quando "Semanas" selecionado
- Transição de término: Inputs habilitam/desabilitam com fade

---

### Tela 4: Drawer — Detalhe da Conta

**Layout**: Drawer lateral direita (full-height, ~480px de largura)

**Elementos**:

```
┌───────────────────────────────────────┐
│  ✕  Conta #1234     [✏] [📋]       │
│                                      │
│  ┌─────────────────────────────┐    │
│  │      R$ 4.800,00            │    │
│  │      🔴 Pendente · Vence hoje│    │
│  │      ↻ mensal (12/12)        │    │
│  └─────────────────────────────┘    │
│                                      │
│  ┌──── Dados Bancários ─────────┐   │
│  │  Nome: C6 Bank               │   │
│  │  CNPJ: 00.000.000/0001-00    │   │
│  │  Chave PIX: 11.99999-9999    │   │
│  └──────────────────────────────┘   │
│                                      │
│  ── Detalhes ──                      │
│  Vencimento: 22/07/2026              │
│  Fornecedor: C6 Bank                 │
│  Categoria: Despesas Adm e Gerais    │
│  Área: MISTO                         │
│  OS: #456 · Fatura Cartão            │
│                                      │
│  ┌─ Recorrência ──────────────────┐  │
│  │ 📅 Próxima parcela: 22/08/26  │  │
│  │ 📊 Parcelas: 12/12 geradas    │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  [Duplicar]      [▼ Pagar Conta]    │
└──────────────────────────────────────┘
```

---

## Princípios de Design

1. **Mostre o que importa, esconda o resto**
   - Tabela de contas: só dados essenciais (vencimento, fornecedor, valor, status)
   - Detalhes em drawer — não poluir a lista
   - Filtros colapsáveis, não fixos
   - *Exemplo*: Ao invés de mostrar 20 colunas, mostrar 5 + "ver mais"

2. **Ações primárias sempre visíveis**
   - "Nova Conta" sempre no topo, não num menu
   - "Pagar" no drawer sempre visível, não precisa rolar
   - Botão de confirmação no canto inferior direito (padrão do usuário)
   - *Exemplo*: Botão "Concluir" da recorrência sempre visível no fim do modal

3. **Cor como informação, não decoração**
   - 🔴 Vencido / 🟡 Pendente / 🟢 Pago — cores padronizadas no sistema inteiro
   - ↻ Laranja (#fb4d06) para recorrência (identidade da marca)
   - Nunca usar cor como único indicador — acompanhar de texto/ícone
   - *Exemplo*: Status tem cor + texto + badge shape

4. **Desktop-first, densidade controlada**
   - Aproveitar tela grande sem sobrecarregar
   - Tabela ocupa ~70% da largura, deixando espaço para respirar
   - Inputs não precisam ser gigantes — densidade de informação é aceitável
   - *Exemplo*: Input numérico da recorrência com 80px é suficiente

5. **Prevenção de erro > Mensagem de erro**
   - Desabilitar campos que não fazem sentido (ex: input data desabilitado se "Nunca" selecionado)
   - Confirmar ações destrutivas ou que geram múltiplos registros
   - Mostrar preview antes de executar (ex: "Serão geradas 6 parcelas")
   - *Exemplo*: Ao salvar recorrência, mostrar resumo antes de criar parcelas

---

## Requisitos de Acessibilidade

### Navegação por Teclado
- [x] **Tab entre campos** na ordem visual (cima → baixo, esquerda → direita)
- [x] **Enter** no botão "Concluir" salva o modal
- [x] **Escape** fecha qualquer modal/drawer
- [x] **Arrow keys** navegam entre dias da semana (quando foco no grupo)
- [x] **Foco visível**: outline 2px laranja (#fb4d06) com ring offset
- [x] **Botão "Nova Conta"** acessível via atalho `Alt+N`

### Suporte a Leitores de Tela
- [x] **Labels associadas** a inputs (não usar placeholder como label)
- [x] **Botões de toggle dia** têm `aria-pressed` para estado selecionado/não
- [x] **Radio group** "Termina em" tem `role="radiogroup"` + `aria-label`
- [x] **Modal** tem `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- [x] **Drawer** tem `role="complementary"` + `aria-label="Detalhes da conta"`
- [x] **Badge de recorrência** tem `aria-label="Conta recorrente: mensal, parcela 12 de 12"`

### Acessibilidade Visual
- [x] **Contraste**: Texto #171717 sobre fundo #FFFFFF = 17.4:1 ✅ (WCAG AAA)
- [x] **Contraste**: Texto #9CA3AF sobre #FFFFFF = 3.2:1 ⚠️ (apenas para labels secundárias)
- [x] **Touch targets**: Botões mín 44px altura, inputs 40px altura
- [x] **Não depende de cor**: Status usam ícone + texto + badge (não só cor)
- [x] **Redimensionamento**: Layout quebra para 2 colunas → 1 coluna em 200% zoom

### Estados de Foco no Figma
```
Input normal:      ┌──────────────────┐
                   │  border-gray-200 │
                   └──────────────────┘

Input foco:        ┌──────────────────┐
                   │  border-gray-200 │
                   │  ring-2 laranja  │ ← outline #fb4d06 30% opacity
                   └──────────────────┘

Input erro:        ┌──────────────────┐
                   │  border-red-400  │
                   │  ❌ Mensagem de  │ ← texto em red-600
                   │     erro aqui    │
                   └──────────────────┘

Input desabilitado:┌──────────────────┐
                   │  bg-gray-50      │ ← fundo acinzentado
                   │  text-gray-400   │ ← texto desbotado
                   │  cursor-not-all. │
                   └──────────────────┘
```

---

## Mensagem de Handoff para o Time de Design

```
## Para o Time de Design (Figma)

**Artefatos de pesquisa prontos:**
- Jobs-to-be-Done: docs/ux/plataforma-jtbd.md
- Jornada do Usuário: docs/ux/plataforma-journey.md
- Especificação de Fluxo: docs/ux/plataforma-flow.md

**Telas a prototipar no Figma:**
1. Lista de Contas a Pagar (com filtros, badges de recorrência, status)
2. Modal Nova Conta (formulário completo + seção de recorrência)
3. Modal Recorrência Personalizada (já implementado no código — referência visual)
4. Drawer de Detalhe (com dados bancários, timeline de parcelas)

**Próximos passos:**
1. Revisar a jornada emocional — Estágio 3 (Pagar) é o mais crítico
2. Prototipar o fluxo completo no Figma seguindo a especificação
3. Validar acessibilidade (checklist acima)
4. Testar com a persona Financeiro antes de implementar novos módulos

**Métrica de sucesso chave**: Zero contas vencidas por erro operacional
```
