# Jornada do Usuário — Ciclo Financeiro Completo

## Persona Foco

- **Quem**: Financeiro (responsável pelo depto financeiro)
- **Objetivo**: Manter as contas em dia sem perder prazos e sem retrabalho
- **Contexto**: Desktop, expediente comercial, com múltiplas abas abertas
- **Métrica de Sucesso**: Zero contas vencidas por erro operacional

---

## Mapa da Jornada

```
                            😰😕          😊😌         😰😤          😊✅
                          ╔══════╗     ╔══════╗     ╔══════╗     ╔══════╗
                          ║  1   ║     ║  2   ║     ║  3   ║     ║  4   ║
                          ║LANÇAR║────▶║GERIR ║────▶║PAGAR ║────▶║CONCILIAR║
                          ║CONTA ║     ║RECORR║     ║CONTA ║     ║        ║
                          ╚══════╝     ╚══════╝     ╚══════╝     ╚══════╝
```

---

### Estágio 1: Lançar Conta a Pagar

| Aspecto | Detalhe |
|---|---|
| **O que o usuário faz** | Abre Contas a Pagar > Nova Conta > Preenche fornecedor, descrição, valor, vencimento, modalidade, banco, categoria, área |
| **O que o usuário pensa** | "Preciso lembrar de todos os dados certinhos. Será que já tem esse fornecedor cadastrado?" |
| **O que o usuário sente** | 😰 Tensão — medo de errar valor/data/categoria e distorcer o fluxo de caixa |
| **Dores** | • Muitos campos pra preencher de uma vez • Se esquece de um detalhe, tem que editar depois • Categorias/áreas podem estar desorganizadas |
| **Oportunidade** | • Autocomplete inteligente de fornecedor com dados preenchidos automaticamente • Sugestão de categoria baseada no fornecedor • Salvar rascunho parcial |

---

### Estágio 2: Configurar Recorrência

| Aspecto | Detalhe |
|---|---|
| **O que o usuário faz** | Ativa toggle "Conta recorrente" > Escolhe periodicidade (mensal/quinzenal/semanal/anual) ou abre "Personalizar" para configurar intervalo e término |
| **O que o usuário pensa** | "Essa conta se repete a cada 45 dias por 6 meses... será que o personalizado cobre isso?" |
| **O que o usuário sente** | 😊 Alívio — finalmente não vou precisar copiar manualmente todo mês |
| **Dores** | • Antes do modal: campos de personalização confusos e pouco visuais • Precisava fazer cálculo mental de intervalo/dias • Difícil visualizar quantas parcelas vão ser geradas |
| **Oportunidade** | ✅ **Feito**: Novo modal visual com stepper, toggle de dias e radio de término • Preview do resumo ("Serão geradas X parcelas a cada Y dias") • Para o futuro: mini-timeline visual mostrando as parcelas geradas |
| **Oportunidade futura** | • Ao salvar, mostrar confirmação com "X parcelas serão criadas" + opção de desfazer • Sugerir recorrência automaticamente para contas com mesmo fornecedor/valor |

---

### Estágio 3: Pagar Conta / Acompanhar Vencimentos

| Aspecto | Detalhe |
|---|---|
| **O que o usuário faz** | No dia a dia, vê a lista de contas pendentes → identifica as que vencem hoje/semana → abre detalhe → registra pagamento com data/modalidade/banco → salva dados bancários |
| **O que o usuário pensa** | "Essa amarela vence hoje? Será que já paguei? Qual a chave PIX desse fornecedor mesmo?" |
| **O que o usuário sente** | 😰 Ansiedade — medo de pagar errado, duplicar pagamento, ou perder um vencimento |
| **Dores** | • Contas recorrentes se espalham na lista — difícil saber qual é a original e qual é parcela • Dados bancários do fornecedor precisam ser salvos manualmente • Sem notificação de vencimento (precisa entrar no sistema) |
| **Oportunidade** | • Agrupar contas recorrentes na listagem com expansão "Ver parcelas" • Pré-preencher dados bancários do fornecedor ao abrir pagamento • Badge de "Vence hoje" com destaque visual • **Para o futuro**: notificação push/e-mail de vencimento |

---

### Estágio 4: Conferir / Conciliar

| Aspecto | Detalhe |
|---|---|
| **O que o usuário faz** | No fim do mês/semana, revisa o que foi pago, confere se está tudo certo, planeja os próximos pagamentos |
| **O que o usuário pensa** | "Quanto vai sobrar esse mês depois de pagar tudo? Essas categorias estão batendo com o DRE?" |
| **O que o usuário sente** | 😊 Satisfação quando está tudo certo / 😤 Frustração quando descobre uma conta esquecida |
| **Dores** | • Precisa alternar entre Contas a Pagar, Contas a Receber e Fluxo de Caixa pra ter visão completa • Difícil saber o saldo futuro rapidamente • Sem relatório consolidado |
| **Oportunidade** | • Mini-dashboard na página inicial de finanças com saldo previsto para 30/60/90 dias • Links rápidos entre pagar/receber/fluxo • Badge de alerta quando contas a pagar > saldo previsto |

---

## Termômetro Emocional da Jornada

```
Feliz  😊 ┤                    🟢                       🟢
          │                    Estágio 2               Estágio 4
          │                    (recorrência)           (conciliação ok)
Neutro 😐 ┤
          │
Tenso  😰 ┤  🟢                          🟢
          │  Estágio 1                  Estágio 3
          │  (lançar)                   (pagar)
          └───────────────────────────────────────────────────
             Lançar      Recorrer      Pagar      Conciliar
```

## Insights-Chave para Design

1. **O momento mais crítico é o Estágio 3 (Pagar)** — é onde o erro tem consequência financeira real. A interface precisa dar confiança: mostrar dados bancários claros, histórico de pagamentos, confirmação visual.

2. **Recorrência é o maior alívio emocional** — quando o usuário configura uma recorrência, ele sai de "tensão de lembrar" para "alívio de automatizar". O modal personalizado (que acabamos de criar) ataca exatamente essa dor.

3. **A falta de visão consolidada gera ansiedade** — o usuário quer ver "quanto vou gastar esse mês" sem entrar em 3 telas diferentes. Um dashboard financeiro na página inicial reduziria drasticamente a ansiedade do Estágio 4.

4. **Desktop-first, mas com densidade de informação correta** — tela grande permite tabelas ricas, mas o usuário não quer ler tudo. Priorizar: cores de status, badges, valores em destaque, busca rápida.
