import type { Metadata } from "next";
import { dbGet } from "@/lib/storage-adapter";
import { listarOrcamentos } from "@/lib/storage";
import { totalOrcamento, fmtBRL } from "@/lib/email-orcamento";
import type { Orcamento, OrdemServico, StatusOrcamento, StatusOS } from "@/app/types";
import { STATUS_CONFIG, STATUS_OS_CONFIG } from "@/app/types";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";
import SistemaLogo from "@/app/components/SistemaLogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acompanhamento de Pedidos — Omni Alt",
};

interface RegistroPagamento {
  orcamentoId?: string;
  pago?: boolean;
}

function fmtData(d?: string): string {
  if (!d) return "—";
  // Já está em dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  // YYYY-MM-DD → dd/mm/aaaa
  const [ano, mes, dia] = d.split("-");
  if (ano && mes && dia && ano.length === 4) return `${dia}/${mes}/${ano}`;
  return d;
}

const CINZA: { cor: string; bg: string } = { cor: "text-gray-400", bg: "bg-white/5 border-white/10" };

function coresFornecedor(status: string): { cor: string; bg: string } {
  switch (status) {
    case "Aguardando orçamento": return { cor: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
    case "Orçamento enviado": return { cor: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
    case "Confirmado": return { cor: "text-green-700", bg: "bg-green-50 border-green-200" };
    case "Em produção": return { cor: "text-purple-700", bg: "bg-purple-50 border-purple-200" };
    case "Aguardando coleta": return { cor: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" };
    case "Entregue": return { cor: "text-gray-700", bg: "bg-gray-100 border-gray-200" };
    default: return { cor: "text-gray-500", bg: "bg-gray-50 border-gray-200" };
  }
}

function Chip({ cores, label }: { cores: { cor: string; bg: string }; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${cores.bg} ${cores.cor}`}>
      {label}
    </span>
  );
}

function Etapa({ titulo, cores, label }: { titulo: string; cores: { cor: string; bg: string }; label: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">{titulo}</span>
      <Chip cores={cores} label={label} />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const vendedores = await dbGet<Vendedor[]>("financeiro-vendedores", []);
  const vendedor = vendedores.find((v) => v.linkToken === token);

  if (!vendedor || vendedor.ativo !== true) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <SistemaLogo width={180} height={50} className="mx-auto object-contain" />
          </div>
          <div className="bg-gray-900 rounded-3xl border border-white/10 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v2m0 4h.01" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Link inválido ou revogado</h1>
            <p className="text-gray-400 text-sm">
              Este link de acompanhamento não está mais ativo. Peça para a equipe comercial gerar um novo link.
            </p>
          </div>
          <p className="text-center text-xs text-gray-600 mt-6">Omni Alt — acompanhamento de pedidos</p>
        </div>
      </main>
    );
  }

  const orcamentos = (await listarOrcamentos())
    .filter((o) => o.vendedorId === vendedor.id)
    .sort((a, b) => (b.dataOrcamento || "").localeCompare(a.dataOrcamento || ""));

  const ordens = await dbGet<OrdemServico[]>("ordens-servico", []);
  const faturamentos = await dbGet<{ registros: RegistroPagamento[] }>("faturamentos", { registros: [] });

  const pedidos: {
    orc: Orcamento;
    os?: OrdemServico;
    pago?: boolean;
  }[] = orcamentos.map((orc) => {
    const os = ordens.find((s) => s.orcamentoId === orc.id);
    const fat = faturamentos.registros.find((r) => r.orcamentoId === orc.id);
    return { orc, os, pago: fat?.pago };
  });

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="max-w-3xl w-full mx-auto">
        {/* Cabeçalho */}
        <div className="text-center mb-10">
          <SistemaLogo width={180} height={50} className="mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-white mt-6">Acompanhamento de Pedidos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Olá, <span className="text-white font-semibold">{vendedor.nome}</span> — confira o status dos seus pedidos abaixo.
          </p>
        </div>

        {pedidos.length === 0 ? (
          <div className="bg-gray-900 rounded-3xl border border-white/10 p-12 text-center">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-300 font-medium">Nenhum pedido encontrado</p>
            <p className="text-gray-500 text-sm mt-1">Assim que novos pedidos forem aprovados, eles aparecerão aqui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pedidos.map(({ orc, os, pago }) => {
              const orcCores = STATUS_CONFIG[orc.status as StatusOrcamento] || CINZA;
              const osCores = os ? STATUS_OS_CONFIG[os.status as StatusOS] || CINZA : CINZA;
              const fornCores = os?.statusFornecedor ? coresFornecedor(os.statusFornecedor) : CINZA;
              const pagCores = pago === true ? { cor: "text-green-700", bg: "bg-green-50 border-green-200" } : pago === false ? { cor: "text-orange-700", bg: "bg-orange-50 border-orange-200" } : CINZA;
              const pagLabel = pago === true ? "Pago" : pago === false ? "Aguardando pagamento" : "—";

              return (
                <div key={orc.id} className="bg-gray-900 rounded-3xl border border-white/10 p-6">
                  {/* Cabeçalho do pedido */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="text-white font-bold text-lg leading-tight">
                        Orçamento {orc.numero}
                        {orc.nomeProjeto ? <span className="text-gray-400 font-medium"> · {orc.nomeProjeto}</span> : null}
                      </h2>
                      <p className="text-gray-400 text-sm mt-1">
                        {orc.cliente} · Emitido em {fmtData(orc.dataOrcamento)}
                        {orc.prazoEntrega ? <span className="text-gray-500"> · Entrega: {orc.prazoEntrega}</span> : null}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Valor do pedido</p>
                      <p className="text-xl font-bold text-white">{fmtBRL(totalOrcamento(orc))}</p>
                    </div>
                  </div>

                  {/* Etapas */}
                  <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Etapa titulo="Orçamento" cores={orcCores} label={orc.status} />
                    <Etapa titulo="OS" cores={osCores} label={os ? os.status : "—"} />
                    <Etapa titulo="Fornecedor" cores={fornCores} label={os?.statusFornecedor || "—"} />
                    <Etapa titulo="Pagamento" cores={pagCores} label={pagLabel} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-10">Omni Alt — acompanhamento de pedidos</p>
      </div>
    </main>
  );
}
