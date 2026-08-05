import type { Metadata } from "next";
import { dbGet } from "@/lib/storage-adapter";
import { listarOrcamentos } from "@/lib/storage";
import type { OrdemServico, Projeto, Tarefa } from "@/app/types";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";
import SistemaLogo from "@/app/components/SistemaLogo";
import AcompanhamentoCliente from "./AcompanhamentoCliente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acompanhamento de Pedidos — Omni Alt",
};

interface RegistroPagamento {
  orcamentoId?: string;
  pago?: boolean;
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

  const orcamentos = await listarOrcamentos();

  const ordens = await dbGet<OrdemServico[]>("ordens-servico", []);
  const faturamentos = await dbGet<{ registros: RegistroPagamento[] }>("faturamentos", { registros: [] });
  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);

  const pedidos = orcamentos
    .filter((o) => o.vendedorId === vendedor.id)
    .map((orc) => {
      const os = ordens.find((s) => s.orcamentoId === orc.id);
      const fat = faturamentos.registros.find((r) => r.orcamentoId === orc.id);

      // Coluna atual do kanban de planejamento da tarefa vinculada a este orçamento
      const tarefa = tarefas.find((t) => !t.parentTaskId && t.customFields?.orcamentoId === orc.id);
      let planejamento: { nome: string; cor: string; dataVencimento?: string } | undefined;
      if (tarefa) {
        const proj = projetos.find((p) => p.id === tarefa.projectId);
        const coluna = proj?.statuses.find((s) => s.id === tarefa.statusId);
        if (coluna) planejamento = { nome: coluna.nome, cor: coluna.cor, dataVencimento: tarefa.dataVencimento };
      }

      return { orc, os, pago: fat?.pago, planejamento };
    });

  return (
    <AcompanhamentoCliente token={token} vendedorNome={vendedor.nome} pedidos={pedidos} />
  );
}
