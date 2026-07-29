-- ============================================================
-- Migração: metadados de anexos para Supabase Storage
-- Áreas: Orçamento/OS, Contas a Pagar/Receber/Fluxo de Caixa, Planejamento (board geral)
--
-- IMPORTANTE: este arquivo ainda NÃO foi aplicado a nenhum projeto Supabase.
-- Rode manualmente no SQL Editor do Supabase (ou via `supabase db push`)
-- depois de revisar. Buckets pressupostos como já existentes e privados:
--   orcamento-anexos, financeiro-comprovantes, planejamento-anexos
-- ============================================================

-- ============================================================
-- 1) orcamento_anexos — documentos de Orçamento e Ordem de Serviço
--    bucket: orcamento-anexos
-- ============================================================
create table public.orcamento_anexos (
  id uuid primary key default gen_random_uuid(),
  orcamento_id text,
  ordem_servico_id text,
  nome_original text not null,
  tipo_mime text not null,
  tamanho_bytes bigint not null,
  caminho_storage text not null,
  enviado_por_user_id text not null,
  enviado_por_nome text,
  criado_em timestamptz not null default now(),
  constraint orcamento_anexos_vinculo_check
    check (orcamento_id is not null or ordem_servico_id is not null)
);

create index orcamento_anexos_orcamento_id_idx on public.orcamento_anexos (orcamento_id);
create index orcamento_anexos_ordem_servico_id_idx on public.orcamento_anexos (ordem_servico_id);

comment on table public.orcamento_anexos is
  'Metadados de anexos de Orçamento e Ordem de Serviço (bucket orcamento-anexos). orcamento_id/ordem_servico_id referenciam ids do app — não são FK real, pois orçamentos/OS vivem no KV/Redis, não no Postgres.';

-- ============================================================
-- 2) financeiro_comprovantes — Contas a Pagar / Contas a Receber / Fluxo de Caixa
--    bucket: financeiro-comprovantes
-- ============================================================
create type public.tipo_lancamento_financeiro as enum ('contas_a_pagar', 'contas_a_receber', 'fluxo_caixa');

create table public.financeiro_comprovantes (
  id uuid primary key default gen_random_uuid(),
  tipo_lancamento public.tipo_lancamento_financeiro not null,
  lancamento_id text not null,
  nome_original text not null,
  tipo_mime text not null,
  tamanho_bytes bigint not null,
  caminho_storage text not null,
  enviado_por_user_id text not null,
  enviado_por_nome text,
  criado_em timestamptz not null default now()
);

create index financeiro_comprovantes_lancamento_idx
  on public.financeiro_comprovantes (tipo_lancamento, lancamento_id);

comment on table public.financeiro_comprovantes is
  'Metadados de comprovantes (boleto, comprovante de pagamento, nota fiscal) do bucket financeiro-comprovantes. lancamento_id referencia: id da conta (contas_a_pagar), orcamento_id (contas_a_receber) ou id do lançamento (fluxo_caixa). Não é FK real.';

-- ============================================================
-- 3) planejamento_anexos — cards do board GERAL (app/planejamento/[id]/page.tsx)
--    bucket: planejamento-anexos
--    NÃO se aplica ao board financeiro (app/financeiro/planejamento/page.tsx)
-- ============================================================
create table public.planejamento_anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id text not null,
  nome_original text not null,
  tipo_mime text not null,
  tamanho_bytes bigint not null,
  caminho_storage text not null,
  enviado_por_user_id text not null,
  enviado_por_nome text,
  criado_em timestamptz not null default now()
);

create index planejamento_anexos_tarefa_id_idx on public.planejamento_anexos (tarefa_id);

comment on table public.planejamento_anexos is
  'Metadados de anexos de cards do board GERAL de Planejamento (bucket planejamento-anexos). tarefa_id referencia a Tarefa no KV "planejamento-tarefas". A rota de upload valida que a tarefa pertence ao board geral (projectId != "financeiro") antes de aceitar — não é garantido por constraint no Postgres.';

-- ============================================================
-- RLS — tabelas
-- ============================================================
alter table public.orcamento_anexos enable row level security;
alter table public.financeiro_comprovantes enable row level security;
alter table public.planejamento_anexos enable row level security;

create policy "service_role_full_access" on public.orcamento_anexos
  for all to service_role using (true) with check (true);

create policy "service_role_full_access" on public.financeiro_comprovantes
  for all to service_role using (true) with check (true);

create policy "service_role_full_access" on public.planejamento_anexos
  for all to service_role using (true) with check (true);

-- ============================================================
-- RLS — storage.objects (buckets já existentes)
-- ============================================================
create policy "service_role_orcamento_anexos_bucket" on storage.objects
  for all to service_role
  using (bucket_id = 'orcamento-anexos') with check (bucket_id = 'orcamento-anexos');

create policy "service_role_financeiro_comprovantes_bucket" on storage.objects
  for all to service_role
  using (bucket_id = 'financeiro-comprovantes') with check (bucket_id = 'financeiro-comprovantes');

create policy "service_role_planejamento_anexos_bucket" on storage.objects
  for all to service_role
  using (bucket_id = 'planejamento-anexos') with check (bucket_id = 'planejamento-anexos');
