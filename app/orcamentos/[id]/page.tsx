"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Orcamento, ItemOrcamento, StatusOrcamento, Fornecedor, VersaoOrcamento, Produto, HistoricoAlteracao } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ComboboxCliente from "@/app/components/ComboboxCliente";
import ComboboxFornecedor from "@/app/components/ComboboxFornecedor";
import BuscaProdutoInput from "@/app/components/BuscaProdutoInput";
import ImagemReferencia from "@/app/components/ImagemReferencia";
import { calcularCustoTotal, calcularValorSugerido, calcularMargemReal, recalcularItem, temSurchargeQtdMinima } from "@/lib/calculos";
import PedidoComprasAnexo from "@/app/components/PedidoComprasAnexo";
import CampoData from "@/app/components/CampoData";
import CalculadoraFrete from "@/app/components/CalculadoraFrete";
import CampoPrazoEntrega from "@/app/components/CampoPrazoEntrega";
import CampoPrazoPagamento from "@/app/components/CampoPrazoPagamento";
import type { DocumentoFornecedor } from "@/app/types";
import DocumentoPreview from "./DocumentoPreview";
import TagSelector from "@/app/components/TagSelector";
import MultiUserSelect from "@/app/components/MultiUserSelect";
import { validarOrcamento } from "@/lib/validacao";
import type { ErroValidacao } from "@/lib/validacao";
import { useAutoSave, getDraft, clearDraft } from "@/hooks/useAutoSave";
import HistoricoAtividades from "@/app/components/HistoricoAtividades";

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

const TIPOS = ["Silk", "DTF", "Bordado", "Laser", "Verniz UV", "Tampografia", "Sublimação", "Gravação em relevo", "Outro"];
const MARGEM_PADRAO = 30;
const PERC_HONORARIOS_PADRAO = 10;
const PERC_IMPOSTOS_PADRAO = 19;
const PERC_COMISSAO_PADRAO = 5;
const DRAFT_KEY_PREFIX = "alt_orcamentos_draft_edit_";

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function itemVazio(margem: number): ItemOrcamento {
  return {
    id: gerarId(), kit: "", referencia: "", item: "", acabamento: "Silk", descricao: "",
    quantidade: 1, custoUnitario: 0, freteProducao: 0, custoPersonalizacao: 0,
    margem, percentualComissao: PERC_COMISSAO_PADRAO, valorUnitario: 0, valorAjustado: false, total: 0, diasProducao: undefined, ncm: "",
    categoria: "brindes",
  };
}

function migrarItem(i: Partial<ItemOrcamento>, margemPadrao: number): ItemOrcamento {
  return {
    id: i.id || gerarId(),
    kit: i.kit || "", referencia: i.referencia || "",
    fornecedorId: i.fornecedorId || "",
    fornecedorNome: i.fornecedorNome || "",
    item: i.item || "",
    cor: i.cor || "",
    imagemReferencia: i.imagemReferencia || "",
    ncm: i.ncm || "",
    quantidadeMinima: i.quantidadeMinima ? Number(i.quantidadeMinima) : undefined,
    diasProducao: i.diasProducao ? Number(i.diasProducao) : undefined,
    acabamento: i.acabamento || "Silk", descricao: i.descricao || "",
    quantidade: Number(i.quantidade) || 0,
    custoUnitario: Number(i.custoUnitario) || 0,
    freteProducao: Number(i.freteProducao) || 0,
    custoPersonalizacao: Number(i.custoPersonalizacao) || 0,
    custoEmbalagemIndividual: i.custoEmbalagemIndividual !== undefined ? Number(i.custoEmbalagemIndividual) : undefined,
    custoEmbalagemTransporte: i.custoEmbalagemTransporte !== undefined ? Number(i.custoEmbalagemTransporte) : undefined,
    margem: i.margem !== undefined ? Number(i.margem) : margemPadrao,
    percentualComissao: i.percentualComissao !== undefined ? Number(i.percentualComissao) : PERC_COMISSAO_PADRAO,
    valorUnitario: Number(i.valorUnitario) || 0,
    valorAjustado: i.valorAjustado || false,
    total: Number(i.total) || 0,
    categoria: (i.categoria as "brindes" | "servico") || "brindes",
  };
}

type ModoVisualizacao = "visualizacao" | "revisao";

export default function VisualizarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── Estado de edição (existente) ──
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [errosValidacao, setErrosValidacao] = useState<ErroValidacao[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [cienteAlteracao, setCienteAlteracao] = useState(false);
  const [modalFrete, setModalFrete] = useState(false);
  const [modalFreteProducao, setModalFreteProducao] = useState<string | null>(null);
  const [enderecoFornecedorModal, setEnderecoFornecedorModal] = useState("");
  const [duplicando, setDuplicando] = useState(false);
  const restoredRef = useRef(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  const [projetosPlanejamento, setProjetosPlanejamento] = useState<{ id: string; nome: string; cor: string }[]>([]);

  // ── Novo estado: modo de visualização ──
  const [modo, setModo] = useState<ModoVisualizacao>("visualizacao");
  const [osVinculada, setOsVinculada] = useState<{ id: string; numero: string } | null>(null);

  // ── Produtos cadastrados (para autocomplete ao editar itens) ──
  const [produtos, setProdutos] = useState<Produto[]>([]);

  // ── Estado de versões ──
  const [mostrarPainelVersoes, setMostrarPainelVersoes] = useState(false);
  const [mostrarPainelAtividades, setMostrarPainelAtividades] = useState(false);
  const [versoes, setVersoes] = useState<VersaoOrcamento[]>([]);
  const [mostrarModalVersao, setMostrarModalVersao] = useState(false);
  const [novaVersaoNome, setNovaVersaoNome] = useState("");
  const [salvandoVersao, setSalvandoVersao] = useState(false);
  const [carregandoVersoes, setCarregandoVersoes] = useState(false);

  // ── Logo ──
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // ── Efeitos (existente) ──
  useEffect(() => {
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const margem = data.margemPadrao ?? MARGEM_PADRAO;
        const percHon = data.percHonorarios ?? PERC_HONORARIOS_PADRAO;
        const percImp = data.percImpostos ?? PERC_IMPOSTOS_PADRAO;
        const percCom = data.percComissao ?? PERC_COMISSAO_PADRAO;
        const loaded = {
          ...data,
          margemPadrao: margem,
          percHonorarios: percHon,
          percImpostos: percImp,
          percComissao: percCom,
          itens: (data.itens || []).map((i: Partial<ItemOrcamento>) => migrarItem(i, margem)),
        };
        setOrcamento(loaded);
        const jaDifere =
          percHon !== PERC_HONORARIOS_PADRAO ||
          percImp !== PERC_IMPOSTOS_PADRAO ||
          percCom !== PERC_COMISSAO_PADRAO ||
          margem !== MARGEM_PADRAO;
        setCienteAlteracao(jaDifere);
      });
  }, [id]);

  // Carrega produtos cadastrados para autocomplete na edição de itens
  useEffect(() => {
    fetch("/api/produtos").then((r) => r.json()).then(setProdutos).catch(() => {});
  }, []);

  // Carrega projetos do planejamento para tags
  useEffect(() => {
    fetch("/api/planejamento").then((r) => r.json()).then((data) => {
      if (data?.projetos) {
        setProjetosPlanejamento(data.projetos.map((p: any) => ({ id: p.id, nome: p.nome, cor: p.cor || "#6366f1" })));
      }
    }).catch(() => {});
  }, []);

  // Carrega a logo salva (para usar no PDF)
  useEffect(() => {
    fetch("/api/admin/logo")
      .then((r) => r.json())
      .then((data) => { if (data.logoBase64) setLogoBase64(data.logoBase64); })
      .catch(() => {});
  }, []);

  // Busca OS vinculada
  useEffect(() => {
    if (!orcamento?.id) return;
    fetch("/api/ordens-servico").then((r) => r.json()).then((lista: any[]) => {
      const encontrada = lista.find((o: any) => o.orcamentoId === orcamento.id);
      if (encontrada) setOsVinculada({ id: encontrada.id, numero: encontrada.numero });
    }).catch(() => {});
  }, [orcamento?.id]);

  // Carrega versões ao abrir o painel
  useEffect(() => {
    if (mostrarPainelVersoes) {
      carregarVersoes();
    }
  }, [mostrarPainelVersoes]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftKey = `${DRAFT_KEY_PREFIX}${id}`;
  const { savedAt: draftSavedAt, isSaving: draftIsSaving } = useAutoSave(draftKey, orcamento, orcamento !== null);

  // Restaura rascunho do localStorage após carregar dados da API
  useEffect(() => {
    if (restoredRef.current || !orcamento) return;
    const draft = getDraft<Orcamento>(draftKey);
    if (draft && Date.now() - draft.savedAt.getTime() < 24 * 60 * 60 * 1000) {
      setOrcamento(draft.data);
      setRascunhoRestaurado(true);
      setTimeout(() => setRascunhoRestaurado(false), 4000);
    }
    restoredRef.current = true;
  }, [orcamento]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modalFreteProducao || !orcamento) { setEnderecoFornecedorModal(""); return; }
    const item = orcamento.itens.find((i) => i.id === modalFreteProducao);
    if (!item?.fornecedorId) return;
    fetch(`/api/fornecedores/${item.fornecedorId}`)
      .then((r) => r.json())
      .then((f: Fornecedor) => {
        const addr = [f.endereco, f.cidade, f.estado].filter(Boolean).join(", ");
        if (addr) setEnderecoFornecedorModal(addr);
      })
      .catch(() => {});
  }, [modalFreteProducao]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preenche nome da versão ao abrir modal
  useEffect(() => {
    if (mostrarModalVersao) {
      setNovaVersaoNome(sugerirNomeVersao());
    }
  }, [mostrarModalVersao]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Funções (existente) ──
  function atualizarCampo(campo: keyof Orcamento, valor: string | number | boolean) {
    setSalvo(false);
    setOrcamento((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  function margemExtraAtual(prev: Orcamento) {
    return (prev.percHonorarios || 0) + (prev.percImpostos || 0) + (prev.percComissao || 0);
  }

  function aplicarMargemPadraoATodos(novaMargemPadrao: number) {
    setSalvo(false);
    setCienteAlteracao(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        margemPadrao: novaMargemPadrao,
        itens: prev.itens.map((item) => {
          const novaMargemItem = item.margem >= prev.margemPadrao
            ? novaMargemPadrao
            : Math.min(item.margem, novaMargemPadrao);
          return recalcularItem({ ...item, margem: novaMargemItem, valorAjustado: false }, me);
        }),
      };
    });
  }

  function atualizarMargemExtra(campo: "percHonorarios" | "percImpostos" | "percComissao", valor: number) {
    setSalvo(false);
    setCienteAlteracao(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [campo]: valor };
      const me = margemExtraAtual(updated);
      return {
        ...updated,
        itens: prev.itens.map((item) => recalcularItem(item, me)),
      };
    });
  }

  function atualizarItem(itemId: string, campo: keyof ItemOrcamento, valor: string | number | boolean | undefined) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) => {
          if (item.id !== itemId) return item;
          const atualizado = { ...item, [campo]: valor };
          if (campo === "valorUnitario") {
            atualizado.valorAjustado = true;
            atualizado.valorUnitario = Math.round(Number(valor) * 100) / 100;
            atualizado.total = Math.round(atualizado.valorUnitario * (atualizado.quantidade || 0) * 100) / 100;
            return atualizado;
          }
          return recalcularItem(atualizado, me);
        }),
      };
    });
  }

  function resetarValorItem(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) =>
          item.id !== itemId ? item : recalcularItem({ ...item, valorAjustado: false }, me)
        ),
      };
    });
  }

  function adicionarItem() {
    setSalvo(false);
    setOrcamento((prev) => prev ? {
      ...prev,
      itens: [...prev.itens, itemVazio(prev.margemPadrao)],
    } : prev);
  }

  function removerItem(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => prev ? { ...prev, itens: prev.itens.filter((i) => i.id !== itemId) } : prev);
  }

  /* ═══ Busca e seleção de produtos cadastrados ═══ */

  function selecionarProduto(itemId: string, p: Produto) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) => {
          if (item.id !== itemId) return item;
          return recalcularItem({
            ...item,
            item: p.nome,
            referencia: p.sku || item.referencia,
            fornecedorId: p.fornecedorId || item.fornecedorId,
            fornecedorNome: p.fornecedorNome || item.fornecedorNome,
            imagemReferencia: p.imagemUrl || item.imagemReferencia,
            cor: p.cor || item.cor,
            ncm: p.ncm || item.ncm,
            custoUnitario: p.precoCusto || 0,
            valorUnitario: p.precoFinal ?? item.valorUnitario,
            valorAjustado: p.precoFinal ? true : item.valorAjustado,
            descricao: p.informacaoTecnica || "",
          }, me);
        }),
      };
    });
  }

  function novoProdutoCriado(p: Produto) {
    setProdutos((prev) => [p, ...prev]);
  }

  /* ═══ Variantes helpers ═══ */

  function adicionarVariante(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) => {
          if (item.id !== itemId) return item;
          const nova = { id: gerarId(), descricao: "", quantidade: 1, custoUnitario: 0, valorUnitario: 0, total: 0 };
          const variantes = [...(item.variantes || []), nova];
          return recalcularItem({ ...item, variantes }, me);
        }),
      };
    });
  }

  function atualizarVariante(itemId: string, varianteId: string, campo: string, valor: number | string) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) => {
          if (item.id !== itemId) return item;
          const variantes = (item.variantes || []).map((v) =>
            v.id !== varianteId ? v : { ...v, [campo]: valor }
          );
          return recalcularItem({ ...item, variantes }, me);
        }),
      };
    });
  }

  function removerVariante(itemId: string, varianteId: string) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) => {
          if (item.id !== itemId) return item;
          const variantes = (item.variantes || []).filter((v) => v.id !== varianteId);
          return recalcularItem({ ...item, variantes: variantes.length > 0 ? variantes : undefined }, me);
        }),
      };
    });
  }

  function removerTodasVariantes(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) =>
          item.id !== itemId ? item : recalcularItem({ ...item, variantes: undefined }, me)
        ),
      };
    });
  }

  async function salvar() {
    if (!orcamento) return;

    // Valida campos obrigatórios
    const erros = validarOrcamento(orcamento);
    if (erros.length > 0) {
      setErrosValidacao(erros);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrosValidacao([]);

    if (percentuaisAlterados && !cienteAlteracao) {
      alert("Confirme a caixa 'Estou ciente da alteração nas porcentagens' na seção de Margens antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(`/api/orcamentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orcamento),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Erro HTTP ${res.status}` }));
        throw new Error(errBody.error || `Erro HTTP ${res.status}`);
      }
      setSalvo(true);
      clearDraft(draftKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.";
      setErrosValidacao([{ campo: "geral", label: "Erro", mensagem: msg }]);
    } finally {
      setSalvando(false);
    }
  }

  async function gerarPdf(tipo: "especificacoes" | "valores" | "os") {
    setGerandoPdf(true);
    try {
      const res = await fetch(`/api/pdf/${id}?tipo=${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoBase64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Erro HTTP ${res.status}` }));
        throw new Error(err.error || `Erro HTTP ${res.status}`);
      }
      const blob = await res.blob();
      if (blob.type !== "application/pdf" || blob.size < 100) {
        throw new Error("PDF gerado é inválido");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const nomeProj = (orcamento?.nomeProjeto || "sem-nome")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      a.download = tipo === "os"
        ? `altmkt_${orcamento?.numero}_${nomeProj}.pdf`
        : `altmkt_${orcamento?.numero}_${nomeProj}_${tipo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PDF.";
      alert(msg);
      console.error("[PDF CLIENT]", msg);
    } finally {
      setGerandoPdf(false);
    }
  }

  // ── Versões ──
  function sugerirNomeVersao(): string {
    return `v${versoes.length + 1}`;
  }

  async function carregarVersoes() {
    setCarregandoVersoes(true);
    try {
      const res = await fetch(`/api/orcamentos/${id}/versoes`);
      if (res.ok) {
        const data = await res.json();
        setVersoes(data);
      }
    } catch {
      // silencioso — lista não crítica
    } finally {
      setCarregandoVersoes(false);
    }
  }

  async function handleSalvarVersao() {
    if (!orcamento || !novaVersaoNome.trim()) return;
    setSalvandoVersao(true);
    try {
      const { versoes: _, ...dadosSnapshot } = orcamento;
      const res = await fetch(`/api/orcamentos/${id}/versoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novaVersaoNome.trim(), dados: dadosSnapshot }),
      });
      if (!res.ok) throw new Error("Erro ao salvar versão");
      const novaVersao: VersaoOrcamento = await res.json();
      setVersoes((prev) => [novaVersao, ...prev]);
      setMostrarModalVersao(false);
      setNovaVersaoNome("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar versão";
      alert(msg);
    } finally {
      setSalvandoVersao(false);
    }
  }

  async function handleRestaurarVersao(versaoId: string) {
    if (!confirm("Restaurar esta versão? Alterações não salvas serão perdidas.")) return;
    try {
      const res = await fetch(`/api/orcamentos/${id}/versoes/${versaoId}/restaurar`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao restaurar versão");
      const dadosRestaurados = await res.json();
      setOrcamento((prev) => {
        if (!prev) return prev;
        const margem = dadosRestaurados.margemPadrao ?? MARGEM_PADRAO;
        return {
          ...dadosRestaurados,
          id: prev.id,
          createdAt: prev.createdAt,
          versoes: prev.versoes,
          itens: (dadosRestaurados.itens || []).map((i: Partial<ItemOrcamento>) => migrarItem(i, margem)),
        };
      });
      setSalvo(false);
      setMostrarPainelVersoes(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao restaurar versão";
      alert(msg);
    }
  }

  async function deletar() {
    if (!confirm("Deletar este orçamento permanentemente?")) return;
    try {
      const res = await fetch(`/api/orcamentos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao deletar" }));
        alert(err.error);
        return;
      }
      router.refresh();
      router.push("/orcamentos");
    } catch {
      alert("Erro ao deletar. Verifique sua conexão.");
    }
  }

  async function duplicar() {
    if (!orcamento) return;
    setDuplicando(true);
    try {
      // Gera novo ID
      const novoId = Math.random().toString(36).substring(2, 10);

      // Busca novo número sequencial
      const resNum = await fetch("/api/numero");
      if (!resNum.ok) throw new Error("Erro ao gerar número");
      const { numero } = await resNum.json();

      // Monta cópia profunda
      const copia: Orcamento = {
        ...orcamento,
        id: novoId,
        numero,
        status: "Em andamento",
        createdAt: new Date().toISOString().split("T")[0],
        versoes: [],
        userId: undefined,
        userEmail: undefined,
        userName: undefined,
      };

      // Salva via POST (dispara sincronizarTarefasOrcamento automaticamente)
      const res = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copia),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao duplicar" }));
        alert(err.error);
        return;
      }

      const salvo = await res.json();
      router.push(`/orcamentos/${salvo.id}`);
    } catch {
      alert("Erro ao duplicar orçamento. Tente novamente.");
    } finally {
      setDuplicando(false);
    }
  }

  // ── Variáveis derivadas ──
  if (!orcamento) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>
  );

  const margemExtra = (orcamento.percHonorarios || 0) + (orcamento.percImpostos || 0) + (orcamento.percComissao || 0);
  const percentuaisAlterados =
    (orcamento.percHonorarios ?? PERC_HONORARIOS_PADRAO) !== PERC_HONORARIOS_PADRAO ||
    (orcamento.percImpostos ?? PERC_IMPOSTOS_PADRAO) !== PERC_IMPOSTOS_PADRAO ||
    (orcamento.percComissao ?? PERC_COMISSAO_PADRAO) !== PERC_COMISSAO_PADRAO ||
    orcamento.margemPadrao !== MARGEM_PADRAO;
  const totalProdutos = orcamento.itens.reduce((a, i) => a + (i.total || 0), 0);
  const totalServicos = orcamento.manuseio && orcamento.custoManuseio ? orcamento.custoManuseio : 0;
  const freteValorNum = (orcamento.freteValor ?? 0) > 0 ? (orcamento.freteValor ?? 0) : 0;
  const totalGeral = totalProdutos + totalServicos + freteValorNum;

  return (
    <WorkspaceLayout>
      <main className="px-4 md:px-8 py-8 w-full max-w-full">
        {/* Cabeçalho com informações fixas */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Orçamento #{orcamento.numero}</h1>
            <p className="text-gray-500 text-base">{orcamento.cliente || "Sem cliente"} · {orcamento.dataOrcamento}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border ${STATUS_CONFIG[orcamento.status || "Em andamento"].bg} ${STATUS_CONFIG[orcamento.status || "Em andamento"].cor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[orcamento.status || "Em andamento"].dot}`} />
              {orcamento.status || "Em andamento"}
            </span>
            <button onClick={() => gerarPdf("valores")} disabled={gerandoPdf} className="bg-gray-800 text-white text-sm font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-700 transition disabled:opacity-50">
              ⬇ Download PDF
            </button>
            <button
              onClick={duplicar}
              disabled={duplicando}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              title="Duplicar orçamento"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {duplicando ? "Duplicando..." : "Duplicar"}
            </button>
            <button
              onClick={deletar}
              className="text-sm font-semibold py-1.5 px-3 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 border border-red-200 hover:border-red-300 transition"
              title="Excluir orçamento"
            >
              <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Excluir
            </button>
          </div>
        </div>

        {/* Alerta de erros de validação */}
        {errosValidacao.length > 0 && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  {errosValidacao[0]?.campo === "geral"
                    ? errosValidacao[0].mensagem
                    : "Corrija os campos abaixo antes de salvar:"}
                </p>
                {errosValidacao[0]?.campo !== "geral" && (
                  <ul className="space-y-1">
                    {errosValidacao.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span><strong>{e.label}:</strong> {e.mensagem}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={() => setErrosValidacao([])}
                className="text-red-400 hover:text-red-600 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {rascunhoRestaurado && (
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm text-blue-700 font-medium">Rascunho restaurado automaticamente</span>
          </div>
        )}

        {/* Abas: Visualização | Revisão */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          <button
            onClick={() => setModo("visualizacao")}
            className={`flex items-center gap-2 px-5 py-3 text-base font-medium border-b-2 transition ${
              modo === "visualizacao"
                ? "border-[#fb4d06] text-[#fb4d06]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Visualização do Documento
          </button>
          <button
            onClick={() => setModo("revisao")}
            className={`flex items-center gap-2 px-5 py-3 text-base font-medium border-b-2 transition ${
              modo === "revisao"
                ? "border-[#fb4d06] text-[#fb4d06]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Revisão / Edição
          </button>
        </div>

        {/* ═══════════════════════════════════════════════
           MODO: VISUALIZAÇÃO (Documento Vivo Editável)
           ═══════════════════════════════════════════════ */}
        {modo === "visualizacao" ? (
          <div>
            {/* ── Tags (projetos) exibidas como badges no topo ── */}
            {orcamento.tags && orcamento.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {orcamento.tags.map((tagId) => {
                  const proj = projetosPlanejamento.find((p) => p.id === tagId);
                  if (!proj) return null;
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-white shadow-sm"
                      style={{ backgroundColor: proj.cor, boxShadow: `0 0 8px ${proj.cor}55` }}
                    >
                      <span className="w-2 h-2 rounded-full bg-white/60" />
                      {proj.nome}
                    </span>
                  );
                })}
              </div>
            )}

            {/* OS vinculada */}
            {osVinculada && (
              <Link
                href={`/ordens-servico/${osVinculada.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold text-white bg-gray-800 hover:bg-gray-700 transition mb-4"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                OS #{osVinculada.numero}
              </Link>
            )}

            <DocumentoPreview
              orcamento={orcamento}
              onUpdateCampo={atualizarCampo}
              onUpdateItem={atualizarItem}
              onDownloadPdf={() => gerarPdf("valores")}
              gerandoPdf={gerandoPdf}
              logoBase64={logoBase64}
              onLogoChange={(b64) => setLogoBase64(b64)}
            />
          </div>
        ) : (
          /* ════════════════════════════════════════════════
             MODO: REVISÃO / EDIÇÃO
             ════════════════════════════════════════════════ */
          <>
            {/* Botão voltar */}
            <div className="mb-4">
              <button
                onClick={() => setModo("visualizacao")}
                className="text-sm text-gray-500 hover:text-[#fb4d06] transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar para Visualização
              </button>
            </div>

            {/* Barra de ações */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex gap-2 flex-wrap items-center">
                {/* Status dropdown */}
                <div className="relative group">
                  <button className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border ${STATUS_CONFIG[orcamento.status || "Em andamento"].bg} ${STATUS_CONFIG[orcamento.status || "Em andamento"].cor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[orcamento.status || "Em andamento"].dot}`} />
                    {orcamento.status || "Em andamento"}
                    <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute z-20 top-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px] sm:min-w-[160px] hidden group-focus-within:block group-hover:block">
                    {TODOS_STATUS.map((s) => (
                      <button key={s}
                        onClick={() => {
                          if (s === "Aprovado" && !orcamento.prazoPagamento) {
                            const ok = window.confirm("Prazo de Pagamento não preenchido. O orçamento aprovado ainda não aparecerá no Contas a Receber até que o prazo seja definido. Deseja continuar?");
                            if (!ok) return;
                          }
                          atualizarCampo("status", s);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${s === (orcamento.status || "Em andamento") ? "font-bold" : ""}`}>
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <PedidoComprasAnexo
                  orcamentoId={id}
                  documentos={orcamento.documentos || []}
                  onUpdate={(docs: DocumentoFornecedor[]) =>
                    setOrcamento((prev) => prev ? { ...prev, documentos: docs } : prev)
                  }
                />
                {salvo && <span className="text-green-600 text-sm font-medium">✓ Salvo</span>}
                {draftSavedAt && !salvo && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {draftIsSaving ? "Salvando rascunho..." : `Rascunho salvo ${formatRelativeTime(draftSavedAt)}`}
                  </span>
                )}
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="bg-green-600 text-white text-sm font-semibold py-2 px-5 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  onClick={() => gerarPdf("os")}
                  disabled={gerandoPdf}
                  className="bg-gray-800 text-white text-sm font-semibold py-2 px-4 rounded-xl hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {gerandoPdf ? "Gerando..." : "OS"}
                </button>
                <button
                  onClick={() => gerarPdf("especificacoes")}
                  disabled={gerandoPdf}
                  className="bg-white border border-[#fb4d06]/30 text-[#fb4d06] text-sm font-semibold py-2 px-4 rounded-xl hover:bg-[#fb4d06]/5 transition disabled:opacity-50"
                >
                  PDF Especificações
                </button>
                <button
                  onClick={() => gerarPdf("valores")}
                  disabled={gerandoPdf}
                  className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-4 rounded-xl hover:opacity-90 transition disabled:opacity-50"
                >
                  {gerandoPdf ? "Gerando..." : "PDF Valores"}
                </button>
                <button
                  onClick={duplicar}
                  disabled={duplicando}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                  title="Duplicar orçamento"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {duplicando ? "Duplicando..." : "Duplicar"}
                </button>
                <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-2 py-2">
                  Excluir
                </button>
              </div>
            </div>

            {/* Botões de versão */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setMostrarModalVersao(true)}
                className="text-sm font-semibold py-2 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Salvar Versão
              </button>
              <button
                onClick={() => setMostrarPainelVersoes(!mostrarPainelVersoes)}
                className={`text-sm font-semibold py-2 px-4 rounded-lg border transition flex items-center gap-1.5 ${
                  mostrarPainelVersoes
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Versões
                {versoes.length > 0 && (
                  <span className="ml-0.5 text-sm bg-current rounded-full px-1.5 py-0.5"
                    style={{ color: mostrarPainelVersoes ? "#fff" : "#6b7280", background: mostrarPainelVersoes ? "#fff" : "#e5e7eb" }}>
                    {versoes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMostrarPainelAtividades(!mostrarPainelAtividades)}
                className={`text-sm font-semibold py-2 px-4 rounded-lg border transition flex items-center gap-1.5 ${
                  mostrarPainelAtividades
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Atividades
                {(orcamento.historico?.length ?? 0) > 0 && (
                  <span className="ml-0.5 text-sm bg-current rounded-full px-1.5 py-0.5"
                    style={{ color: mostrarPainelAtividades ? "#fff" : "#6b7280", background: mostrarPainelAtividades ? "#fff" : "#e5e7eb" }}>
                    {orcamento.historico!.length}
                  </span>
                )}
              </button>
            </div>

            {/* Painel de versões */}
            {mostrarPainelVersoes && (
              <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Histórico de Versões</h3>
                </div>
                {carregandoVersoes ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">Carregando...</div>
                ) : versoes.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma versão salva ainda.</div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {versoes.map((v) => (
                      <div key={v.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{v.nome}</p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {new Date(v.criadaEm).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestaurarVersao(v.id)}
                          className="text-sm font-semibold py-1.5 px-3 rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200 hover:border-blue-300 transition shrink-0 ml-3"
                        >
                          Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Painel de atividades */}
            {mostrarPainelAtividades && (
              <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Atividades Recentes</h3>
                </div>
                <HistoricoAtividades historico={orcamento.historico} />
              </div>
            )}

              {/* Audit trail */}
              {(orcamento.userName || orcamento.updatedBy) && (
                <p className="text-xs text-gray-400 mb-4">
                  👤 Criado por {orcamento.userName || "—"} · {orcamento.createdAt ? new Date(orcamento.createdAt).toLocaleDateString("pt-BR") : "—"}
                  {orcamento.updatedBy && <> · ✏️ Última alteração por {orcamento.updatedBy} · {orcamento.updatedAt ? new Date(orcamento.updatedAt).toLocaleString("pt-BR") : "—"}</>}
                </p>
              )}

            {/* Informações gerais */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-base font-semibold text-gray-600 uppercase tracking-wide mb-4">Informações Gerais</h2>

              {/* Linha 1: Nº + Projeto + Cliente + Solicitante */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Nº Orçamento</label>
                  <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-base font-bold text-[#fb4d06]">
                    {orcamento.numero}
                  </div>
                </div>
                <Campo label="Nome do Projeto" value={orcamento.nomeProjeto || ""} onChange={(v) => atualizarCampo("nomeProjeto", v)} />
                <ComboboxCliente value={orcamento.cliente} onChange={(v) => atualizarCampo("cliente", v)} onSelect={(c) => { atualizarCampo("cliente", c.nomeEmpresa || c.razaoSocial); setOrcamento((prev) => prev ? { ...prev, clienteId: c.id } : prev); }} />
                <Campo label="Solicitante" value={orcamento.solicitante} onChange={(v) => atualizarCampo("solicitante", v)} />
              </div>

              {/* Projetos (tags) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-2">Projetos</label>
                <TagSelector
                  projetos={projetosPlanejamento}
                  selected={orcamento.tags || []}
                  onChange={(ids) => { setSalvo(false); setOrcamento((prev) => prev ? { ...prev, tags: ids } : prev); }}
                />
              </div>

              {/* Participantes */}
              <div className="mb-4">
                <MultiUserSelect
                  value={orcamento.participantes || []}
                  onChange={(participantes) => { setSalvo(false); setOrcamento((prev) => prev ? { ...prev, participantes } : prev); }}
                  label="Participantes"
                  placeholder="Adicionar participante..."
                />
              </div>

              {/* Linha 2: Responsável + Data solicitação + Data elaboração + Tipo nota */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <Campo label="Responsável pelo orçamento" value={orcamento.responsavel || ""} onChange={(v) => atualizarCampo("responsavel", v)} />
                <CampoData
                  label="Data da solicitação"
                  value={orcamento.dataSolicitacao || ""}
                  onChange={(v) => atualizarCampo("dataSolicitacao", v)}
                />
                <CampoData
                  label="Data da elaboração"
                  value={orcamento.dataOrcamento}
                  onChange={(v) => atualizarCampo("dataOrcamento", v)}
                  autoFilled
                />
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Tipo de nota</label>
                  <div className="flex gap-2">
                    {(["DANFE", "NFSE"] as const).map((tipo) => {
                      const ativo = (orcamento.tiposNota || []).includes(tipo);
                      return (
                        <button key={tipo} type="button"
                          onClick={() => {
                            const atual = orcamento.tiposNota || [];
                            atualizarCampo("tiposNota" as keyof typeof orcamento, (ativo ? atual.filter((t) => t !== tipo) : [...atual, tipo]) as unknown as string);
                          }}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${
                            ativo ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                          }`}>
                          {tipo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Linha 3: Prazos */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <CampoPrazoPagamento
                    value={orcamento.prazoPagamento}
                    onChange={(v) => atualizarCampo("prazoPagamento", v)}
                  />
                  {!orcamento.prazoPagamento && (
                    <p className="text-xs text-amber-600 mt-1">Sem prazo de pagamento → não gera vencimento no Contas a Receber</p>
                  )}
                </div>
                <CampoPrazoEntrega
                  value={orcamento.prazoEntrega}
                  onChange={(v) => atualizarCampo("prazoEntrega", v)}
                  sugestaoDias={(() => {
                    const vals = orcamento.itens.map((i) => i.diasProducao || 0).filter((d) => d > 0);
                    return vals.length ? Math.max(...vals) : null;
                  })()}
                />
              </div>

              {/* Linha 4: Observações + Frete */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Observações</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-red-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    value={orcamento.observacoes}
                    onChange={(e) => atualizarCampo("observacoes", e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-500">Frete</label>
                    <button
                      type="button"
                      onClick={() => setModalFrete(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#fb4d06] hover:underline"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Calculadora
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number" min={0} step="0.01"
                      className="w-full sm:w-36 border border-gray-200 rounded-lg px-3 py-2.5 text-base font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                      value={orcamento.freteValor && orcamento.freteValor > 0 ? orcamento.freteValor : ""}
                      onChange={(e) => atualizarCampo("freteValor", e.target.value ? parseFloat(e.target.value) : 0)}
                      placeholder="Valor (R$)"
                    />
                    <input
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-base bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                      value={orcamento.frete || ""}
                      onChange={(e) => atualizarCampo("frete", e.target.value)}
                      placeholder="Descrição (opcional)"
                    />
                  </div>
                </div>
              </div>

              {/* Manuseio */}
              <div className="mt-4 border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Manuseio específico</p>
                    <p className="text-sm text-gray-400 mt-0.5">Será tratado como serviço · NF-e de Serviço</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => atualizarCampo("manuseio", !orcamento.manuseio)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${orcamento.manuseio ? "bg-[#fb4d06]" : "bg-gray-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${orcamento.manuseio ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {orcamento.manuseio && (
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">Custo do manuseio (R$)</label>
                      <input
                        type="number" min={0} step="0.01"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
                        value={orcamento.custoManuseio || ""}
                        onChange={(e) => atualizarCampo("custoManuseio", parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    {!!orcamento.custoManuseio && (
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Valor do serviço</p>
                        <p className="text-base font-bold text-gray-700">
                          R$ {(orcamento.custoManuseio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Margens do Orçamento */}
            <div className="bg-[#fb4d06]/5 border border-[#fb4d06]/20 rounded-2xl p-5 mb-6">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-[#fb4d06] mb-0.5">Margens do Orçamento</h2>
                <p className="text-sm text-[#fb4d06]/70">Definem o preço final de todos os itens. A margem de lucro pode ser reduzida individualmente por item.</p>
              </div>
              <div className="flex flex-wrap gap-5 items-end">
                {(["percHonorarios", "percImpostos", "percComissao"] as const).map((campo) => (
                  <div key={campo} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-[#fb4d06]/70 whitespace-nowrap">
                      {campo === "percHonorarios" ? "Honorários" : campo === "percImpostos" ? "Impostos" : "Comissão"}
                    </label>
                    <div className="relative">
                      <input type="number" min={0} max={100} step="0.1"
                        className="w-full sm:w-24 border border-[#fb4d06]/20 rounded-lg px-3 py-2 pr-7 text-sm text-[#fb4d06] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 text-center"
                        value={orcamento[campo] ?? ""}
                        onChange={(e) => atualizarMargemExtra(campo, parseFloat(e.target.value) || 0)}
                        placeholder="0" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[#fb4d06]/50 pointer-events-none">%</span>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-[#fb4d06]/90 whitespace-nowrap">Margem de Lucro</label>
                  <div className="relative">
                    <input type="number" min={0} max={99}
                      className="w-full sm:w-24 border-2 border-[#fb4d06]/40 rounded-lg px-3 py-2 pr-7 text-sm text-[#fb4d06] font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 text-center"
                      value={orcamento.margemPadrao}
                      onChange={(e) => aplicarMargemPadraoATodos(Number(e.target.value))} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[#fb4d06]/50 pointer-events-none">%</span>
                  </div>
                </div>
              </div>
              {(() => {
                const totalMargem = orcamento.margemPadrao + margemExtra;
                return (
                  <p className="mt-3 text-sm text-[#fb4d06]/60">
                    = <span className="font-semibold text-[#fb4d06]/80">{totalMargem.toFixed(1)}%</span> total
                    {totalMargem < 100 && <> · Markup equivalente: <span className="font-semibold">{(100 / (1 - totalMargem / 100) - 100).toFixed(1)}%</span></>}
                  </p>
                );
              })()}
              {percentuaisAlterados && (
                <label className="flex items-start gap-2.5 mt-3 pt-3 border-t border-[#fb4d06]/15 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cienteAlteracao}
                    onChange={(e) => setCienteAlteracao(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#fb4d06] cursor-pointer shrink-0"
                  />
                  <span className={`text-sm font-semibold ${cienteAlteracao ? "text-[#fb4d06]/70" : "text-amber-700"}`}>
                    Estou ciente da alteração nas porcentagens.
                  </span>
                </label>
              )}
            </div>

            {/* Itens */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-base font-semibold text-gray-600 uppercase tracking-wide mb-4">Itens do Orçamento</h2>

              <div className="flex flex-col gap-5">
                {orcamento.itens.map((item, idx) => {
                  const custoTotal = calcularCustoTotal(item);
                  const valorSugerido = calcularValorSugerido(item, margemExtra);
                  const margemReal = calcularMargemReal(custoTotal, item.valorUnitario);

                  return (
                    <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-3 sm:px-4 py-2 flex items-center justify-between border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#fb4d06] uppercase">Item {idx + 1}</span>
                          <span className="text-sm font-semibold text-gray-400">·</span>
                          <button
                            type="button"
                            onClick={() => atualizarItem(item.id, "categoria", item.categoria === "servico" ? "brindes" : "servico")}
                            className={`text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border transition ${
                              item.categoria === "servico"
                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            {item.categoria === "servico" ? "Serviço" : "Brindes"}
                          </button>
                        </div>
                        {orcamento.itens.length > 1 && (
                          <button onClick={() => removerItem(item.id)} className="text-red-400 hover:text-red-600 text-sm">
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="p-3 sm:p-4 flex flex-col gap-4">
                        {item.categoria === "servico" ? (
                          /* ═══ Serviço ═══ */
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <Campo label="Item" value={item.item} onChange={(v) => atualizarItem(item.id, "item", v)} />
                              <CampoNumero label="Período (dias)" value={item.diasProducao || 0} onChange={(v) => atualizarItem(item.id, "diasProducao", v)} />
                              <CampoNumero label="Quantidade" value={item.quantidade} onChange={(v) => atualizarItem(item.id, "quantidade", v)} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-600 mb-1.5">Descrição</label>
                              <textarea
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base resize-none min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                value={item.descricao}
                                onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                              />
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                              <p className="text-sm font-bold text-purple-600 uppercase tracking-wide mb-3">Valores do Serviço</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-purple-600 mb-1.5">Custo Unitário (R$)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-base text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.custoUnitario || ""}
                                    onChange={(e) => atualizarItem(item.id, "custoUnitario", Number(e.target.value))}
                                    placeholder="0,00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-purple-600 mb-1.5">Margem (%)</label>
                                  <input type="number" min={0} max={99} step={0.5}
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-base text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.margem ?? orcamento.margemPadrao}
                                    onChange={(e) => atualizarItem(item.id, "margem", Number(e.target.value))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-purple-600 mb-1.5">Valor Unit. Sugerido (R$)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-base text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.valorUnitario || ""}
                                    onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))}
                                    placeholder="0,00"
                                  />
                                  {!item.valorAjustado && item.valorUnitario > 0 && (
                                    <p className="text-sm text-purple-400 mt-0.5">Automático</p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-purple-600 mb-1.5">Valor Total (R$)</label>
                                  <div className="text-lg font-bold text-purple-700 py-2">
                                    R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-purple-600 mb-1.5">% Comissão</label>
                                  <input type="number" min={0} max={100} step="0.1"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-base text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.percentualComissao ?? ""}
                                    onChange={(e) => atualizarItem(item.id, "percentualComissao", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* ═══ Brindes ═══ */
                          <>
                            {/* Dados do produto */}
                            {/* Linha principal: imagem + kit + item */}
                            <div className="flex items-end gap-3">
                              <ImagemReferencia
                                valor={item.imagemReferencia}
                                onChange={(v) => atualizarItem(item.id, "imagemReferencia", v)}
                              />
                              <div className="w-36 shrink-0">
                                <label className="block text-sm font-medium text-gray-600 mb-1.5">Kit</label>
                                <input
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
                                  placeholder="Nome do kit"
                                  value={item.kit}
                                  onChange={(e) => atualizarItem(item.id, "kit", e.target.value)}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-600 mb-1.5">Item / Produto</label>
                                <BuscaProdutoInput
                                  value={item.item}
                                  onChange={(v) => atualizarItem(item.id, "item", v)}
                                  produtos={produtos}
                                  onSelect={(p) => selecionarProduto(item.id, p)}
                                  onNovoProduto={(p) => { novoProdutoCriado(p); selecionarProduto(item.id, p); }}
                                />
                              </div>
                            </div>

                            {/* Linha secundária: referência + NCM + fornecedor + cor + acabamento + quantidade + prazo prod */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <Campo label="Referência / SKU" value={item.referencia} onChange={(v) => atualizarItem(item.id, "referencia", v)} />
                              <Campo label="NCM" value={item.ncm || ""} onChange={(v) => atualizarItem(item.id, "ncm", v)} />
                              <ComboboxFornecedor value={item.fornecedorNome || ""} onChange={(v) => atualizarItem(item.id, "fornecedorNome", v)} onSelect={(f) => { atualizarItem(item.id, "fornecedorId", f.id); atualizarItem(item.id, "fornecedorNome", f.nomeFantasia || f.razaoSocial); }} />
                              <Campo label="Cor" value={item.cor || ""} onChange={(v) => atualizarItem(item.id, "cor", v)} />
                              <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1.5">Acabamento</label>
                                <select
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                  value={item.acabamento}
                                  onChange={(e) => atualizarItem(item.id, "acabamento", e.target.value)}
                                >
                                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                                </select>
                              </div>
                              {item.variantes && item.variantes.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <label className="block text-sm font-medium text-gray-500">Quantidade total (calculada)</label>
                                  <div className="w-full border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2.5 text-base text-emerald-700 font-semibold cursor-default">
                                    {item.quantidade}
                                  </div>
                                </div>
                              ) : (
                                <CampoNumero label="Quantidade" value={item.quantidade} onChange={(v) => atualizarItem(item.id, "quantidade", v)} />
                              )}
                              <CampoNumero label="Prazo prod. (dias úteis)" value={item.diasProducao || 0} onChange={(v) => atualizarItem(item.id, "diasProducao", v)} />
                            </div>

                        {/* ═══ Variantes de quantidade ═══ */}
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.variantes && item.variantes.length > 0) {
                                removerTodasVariantes(item.id);
                              } else {
                                adicionarVariante(item.id);
                              }
                            }}
                            className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${item.variantes && item.variantes.length > 0 ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            {item.variantes && item.variantes.length > 0 ? "Variações ativas" : "Variações de quantidade"}
                          </button>

                          {item.variantes && item.variantes.length > 0 && (
                            <div className="mt-3 bg-emerald-50/40 border border-emerald-100 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                                  Variações de quantidade / preço
                                </p>
                                <span className="text-xs text-emerald-600 font-medium">
                                  Total: {item.quantidade} unidades · Média R$ {item.valorUnitario.toFixed(2)}/un
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-emerald-200">
                                      <th className="text-left py-1 pr-2 text-emerald-700 font-semibold">Descrição</th>
                                      <th className="text-center py-1 px-2 text-emerald-700 font-semibold">Qtd</th>
                                      <th className="text-center py-1 px-2 text-emerald-700 font-semibold">Custo Un.</th>
                                      <th className="text-center py-1 px-2 text-emerald-700 font-semibold">Preço Un.</th>
                                      <th className="text-right py-1 pl-2 text-emerald-700 font-semibold">Total</th>
                                      <th className="w-6"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.variantes.map((v) => (
                                      <tr key={v.id} className="border-b border-emerald-100/50">
                                        <td className="py-1 pr-2">
                                          <input
                                            className="w-full min-w-[100px] bg-white border border-emerald-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                            value={v.descricao || ""}
                                            onChange={(e) => atualizarVariante(item.id, v.id, "descricao", e.target.value)}
                                            placeholder="Ex: Azul 500un"
                                          />
                                        </td>
                                        <td className="py-1 px-2">
                                          <input
                                            type="number" min={0} step="1"
                                            className="w-16 bg-white border border-emerald-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                            value={v.quantidade || ""}
                                            onChange={(e) => atualizarVariante(item.id, v.id, "quantidade", parseInt(e.target.value) || 0)}
                                          />
                                        </td>
                                        <td className="py-1 px-2">
                                          <input
                                            type="number" min={0} step="0.01"
                                            className="w-20 bg-white border border-emerald-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                            value={v.custoUnitario || ""}
                                            onChange={(e) => atualizarVariante(item.id, v.id, "custoUnitario", parseFloat(e.target.value) || 0)}
                                            placeholder="0,00"
                                          />
                                        </td>
                                        <td className="py-1 px-2">
                                          <input
                                            type="number" min={0} step="0.01"
                                            className="w-20 bg-white border border-emerald-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                            value={v.valorUnitario || ""}
                                            onChange={(e) => atualizarVariante(item.id, v.id, "valorUnitario", parseFloat(e.target.value) || 0)}
                                            placeholder="0,00"
                                          />
                                        </td>
                                        <td className="py-1 pl-2 text-right font-medium text-emerald-800 whitespace-nowrap">
                                          R$ {v.total.toFixed(2)}
                                        </td>
                                        <td className="py-1">
                                          <button
                                            type="button"
                                            onClick={() => removerVariante(item.id, v.id)}
                                            className="text-red-400 hover:text-red-600 p-0.5"
                                            title="Remover variação"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <button
                                type="button"
                                onClick={() => adicionarVariante(item.id)}
                                className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Adicionar variação
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1.5">Descrição Técnica</label>
                          <textarea
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base resize-none min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                            value={item.descricao}
                            onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                          />
                        </div>

                        {/* Precificação */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Precificação</p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                            <div>
                              <label className={`block text-sm font-medium mb-1 ${temSurchargeQtdMinima(item) ? "text-amber-600" : item.variantes && item.variantes.length > 0 ? "text-emerald-600" : "text-gray-500"}`}>
                                {item.variantes && item.variantes.length > 0 ? "Custo unit. médio (R$)" : "Custo unit. fornecedor (R$)"}
                                {temSurchargeQtdMinima(item) && <span className="ml-1 font-bold">+5%</span>}
                              </label>
                              <input
                                type="number" min={0} step="0.01"
                                disabled={!!(item.variantes && item.variantes.length > 0)}
                                className={`w-full border rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 ${item.variantes && item.variantes.length > 0
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                                  : temSurchargeQtdMinima(item)
                                    ? "border-amber-300 text-amber-700 focus:ring-amber-300 bg-white"
                                    : "border-gray-200 text-gray-700 focus:ring-[#fb4d06]/30 bg-white"}`}
                                value={item.custoUnitario || ""}
                                onChange={(e) => atualizarItem(item.id, "custoUnitario", parseFloat(e.target.value) || 0)}
                                placeholder="0,00"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-600 mb-1.5">Qtd mínima fornecedor</label>
                              <input
                                type="number" min={0} step="1"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 text-gray-700"
                                value={item.quantidadeMinima || ""}
                                onChange={(e) => atualizarItem(item.id, "quantidadeMinima", parseInt(e.target.value) || 0)}
                                placeholder="Sem mínimo"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium text-gray-500">Frete de produção total (R$)</label>
                                <button type="button" onClick={() => setModalFreteProducao(item.id)}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-[#fb4d06] hover:underline">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  Calcular
                                </button>
                              </div>
                              <input type="number" min={0} step="0.01"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                value={item.freteProducao || ""}
                                onChange={(e) => atualizarItem(item.id, "freteProducao", parseFloat(e.target.value) || 0)}
                                placeholder="0,00" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-600 mb-1.5">Custo de personalização total (R$)</label>
                              <input type="number" min={0} step="0.01"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
                                value={item.custoPersonalizacao || ""}
                                onChange={(e) => atualizarItem(item.id, "custoPersonalizacao", parseFloat(e.target.value) || 0)}
                                placeholder="0,00" />
                              <p className="text-sm text-gray-400 mt-0.5">Total ÷ quantidade</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-600 mb-1.5">Margem de Lucro (%)</label>
                              <input
                                type="number" min={0} max={orcamento.margemPadrao}
                                className="w-full border border-[#fb4d06]/20 rounded-lg px-3 py-2.5 text-base text-[#fb4d06] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40"
                                value={item.margem || ""}
                                onChange={(e) => atualizarItem(item.id, "margem", Math.min(Number(e.target.value), orcamento.margemPadrao))}
                              />
                              {item.margem < orcamento.margemPadrao && (
                                <p className="text-sm text-amber-600 mt-0.5">↓ reduzida · padrão: {orcamento.margemPadrao}%</p>
                              )}
                              {margemExtra > 0 && (
                                <p className="text-sm text-[#fb4d06]/60 mt-0.5">
                                  Total: {((item.margem || 0) + margemExtra).toFixed(1)}%
                                  {(orcamento.percHonorarios || 0) > 0 && ` · Hon. ${orcamento.percHonorarios}%`}
                                  {(orcamento.percImpostos || 0) > 0 && ` · Imp. ${orcamento.percImpostos}%`}
                                  {(orcamento.percComissao || 0) > 0 && ` · Com. ${orcamento.percComissao}%`}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-600 mb-1.5">% Comissão</label>
                              <input
                                type="number" min={0} max={100} step="0.1"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                value={item.percentualComissao ?? ""}
                                onChange={(e) => atualizarItem(item.id, "percentualComissao", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                          {/* Embalagem */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => atualizarItem(item.id, "custoEmbalagemIndividual", item.custoEmbalagemIndividual !== undefined ? undefined : 0)}
                              className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${item.custoEmbalagemIndividual !== undefined ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                            >
                              + Embalagem Individual
                            </button>
                            <button
                              type="button"
                              onClick={() => atualizarItem(item.id, "custoEmbalagemTransporte", item.custoEmbalagemTransporte !== undefined ? undefined : 0)}
                              className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${item.custoEmbalagemTransporte !== undefined ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                            >
                              + Embalagem Transporte
                            </button>
                          </div>
                          {(item.custoEmbalagemIndividual !== undefined || item.custoEmbalagemTransporte !== undefined) && (
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {item.custoEmbalagemIndividual !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-indigo-600 mb-1">Embalagem individual (R$ / item)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2.5 text-base text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                    value={item.custoEmbalagemIndividual || ""}
                                    onChange={(e) => atualizarItem(item.id, "custoEmbalagemIndividual", parseFloat(e.target.value) || 0)}
                                    placeholder="0,00" />
                                  <p className="text-sm text-indigo-400 mt-0.5">Custo por unidade, não dividido</p>
                                </div>
                              )}
                              {item.custoEmbalagemTransporte !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-purple-600 mb-1.5">Embalagem transporte total (R$)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-base text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                                    value={item.custoEmbalagemTransporte || ""}
                                    onChange={(e) => atualizarItem(item.id, "custoEmbalagemTransporte", parseFloat(e.target.value) || 0)}
                                    placeholder="0,00" />
                                  <p className="text-sm text-purple-400 mt-0.5">Total dividido pela quantidade</p>
                                </div>
                              )}
                            </div>
                          )}

                          {temSurchargeQtdMinima(item) && (
                            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                              Quantidade ({item.quantidade}) abaixo do mínimo do fornecedor ({item.quantidadeMinima}) — +5% adicionado ao custo unitário automaticamente
                            </div>
                          )}

                          <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-gray-200">
                            {custoTotal > 0 && (
                              <div className="text-sm text-gray-500">
                                Custo total unit.: <span className="font-semibold text-gray-700">R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {valorSugerido > 0 && (
                              <div className="text-sm text-gray-500">
                                Preço sugerido: <span className="font-semibold text-green-700">R$ {valorSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}

                            <div className="flex-1 min-w-0 w-full sm:min-w-[200px]">
                              <div className="flex items-center gap-2 mb-1">
                                <label className="text-sm font-medium text-gray-600">
                                  {item.variantes && item.variantes.length > 0 ? "Preço médio (R$)" : "Preço final ao cliente (R$)"}
                                </label>
                                {item.valorAjustado && (
                                  <button
                                    onClick={() => resetarValorItem(item.id)}
                                    className="text-sm text-blue-500 hover:text-blue-700 underline"
                                  >
                                    Usar calculado
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                disabled={!!(item.variantes && item.variantes.length > 0)}
                                className={`w-full border-2 rounded-lg px-3 py-2.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 ${item.variantes && item.variantes.length > 0
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                                  : item.valorAjustado
                                    ? "border-orange-300 text-orange-700"
                                    : "border-[#fb4d06]/30 text-[#fb4d06]"}`}
                                value={item.valorUnitario || ""}
                                onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))}
                                placeholder={valorSugerido > 0 ? valorSugerido.toFixed(2) : "0,00"}
                              />
                              {item.valorAjustado && item.valorUnitario > 0 && custoTotal > 0 && (
                                <p className="text-sm mt-1 text-orange-600">
                                  Margem real: {margemReal.toFixed(1)}% {margemReal < item.margem ? "↓ abaixo do padrão" : "↑ acima"}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-gray-400">Total do item</p>
                              <p className="text-lg font-bold text-[#fb4d06]">
                                R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>              {/* fecha flex-wrap preço final */}
                        </div>                {/* fecha bg-gray-50 precificação */}
                        </>
                      )}
                      </div>                  {/* fecha p-4 flex-col gap-4 */}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={adicionarItem}
                className="mt-4 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition"
              >
                + Adicionar item
              </button>
            </div>

            {/* Total + salvar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  {!orcamento.mostrarValorTotalItem && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Total Produtos</span>
                      <span className="font-semibold text-gray-700">R$ {totalProdutos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {orcamento.manuseio && !!orcamento.custoManuseio && (
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>Total Serviços <span className="text-sm text-purple-500">(Manuseio · NFSE)</span></span>
                        <span className="font-semibold text-purple-700">R$ {totalServicos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {freteValorNum > 0 ? (
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>Frete de entrega</span>
                        <span className="font-semibold text-blue-700">R$ {freteValorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : orcamento.frete ? (
                      <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between items-center text-sm">
                        <span className="text-gray-500">Frete de entrega</span>
                        <span className="font-semibold text-blue-700">{orcamento.frete}</span>
                      </div>
                    ) : null}
                    <div className="border-t-2 border-gray-200 pt-2 flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Total Geral</span>
                      <p className="text-2xl font-bold text-[#fb4d06]">R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  )}

                  {/* Honorários e Impostos — ativação */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => atualizarCampo("mostrarHonorarios", !orcamento.mostrarHonorarios)}
                        className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition ${
                          orcamento.mostrarHonorarios
                            ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {orcamento.mostrarHonorarios ? "✓ " : ""}Exibir Honorários e Impostos na proposta
                      </button>

                      <button
                        type="button"
                        onClick={() => atualizarCampo("mostrarValorTotalItem", !orcamento.mostrarValorTotalItem)}
                        className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition ${
                          orcamento.mostrarValorTotalItem
                            ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {orcamento.mostrarValorTotalItem ? "✓ " : ""}Exibir valor total por item na proposta
                      </button>
                    </div>

                    {orcamento.mostrarHonorarios && (
                      <div className="mt-3">
                        {((orcamento.percHonorarios ?? 0) > 0 || (orcamento.percImpostos ?? 0) > 0) ? (
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-1.5">
                            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">Composição do Total Geral</p>
                            {(orcamento.percHonorarios ?? 0) > 0 && (
                              <div className="flex items-center justify-between text-sm text-gray-600">
                                <span>Honorários <span className="text-gray-400">({orcamento.percHonorarios}%)</span></span>
                                <span className="font-semibold text-gray-800">
                                  R$ {(totalGeral * (orcamento.percHonorarios ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            {(orcamento.percImpostos ?? 0) > 0 && (
                              <div className="flex items-center justify-between text-sm text-gray-600">
                                <span>Impostos <span className="text-gray-400">({orcamento.percImpostos}%)</span></span>
                                <span className="font-semibold text-gray-800">
                                  R$ {(totalGeral * (orcamento.percImpostos ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-gray-400">Configure os percentuais no campo Honorários e Impostos acima.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="bg-green-600 text-white font-semibold py-3 px-8 rounded-xl hover:bg-green-700 transition disabled:opacity-50 self-start"
                >
                  {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar alterações"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {modalFrete && (
        <CalculadoraFrete
          clienteId={orcamento.clienteId}
          onAplicar={(v, n) => { atualizarCampo("frete", v); atualizarCampo("freteValor", n ?? 0); setSalvo(false); setModalFrete(false); }}
          onFechar={() => setModalFrete(false)}
        />
      )}

      {modalFreteProducao && (() => {
        const itemAtual = orcamento.itens.find((i) => i.id === modalFreteProducao);
        if (!itemAtual) return null;
        return (
          <CalculadoraFrete
            enderecoOrigem={enderecoFornecedorModal}
            onAplicar={() => setModalFreteProducao(null)}
            onAplicarNumerico={(total) => { atualizarItem(modalFreteProducao, "freteProducao", total); setSalvo(false); setModalFreteProducao(null); }}
            onFechar={() => setModalFreteProducao(null)}
            quantidadeItens={itemAtual.quantidade || undefined}
          />
        );
      })()}

      {/* Modal de salvar versão */}
      {mostrarModalVersao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setMostrarModalVersao(false); setNovaVersaoNome(""); }}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-800 mb-1">Salvar Versão</h3>
            <p className="text-sm text-gray-500 mb-4">
              Cria um snapshot do estado atual do orçamento.
            </p>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Nome da versão</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              value={novaVersaoNome}
              onChange={(e) => setNovaVersaoNome(e.target.value)}
              placeholder={sugerirNomeVersao()}
              onKeyDown={(e) => { if (e.key === "Enter") handleSalvarVersao(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setMostrarModalVersao(false); setNovaVersaoNome(""); }}
                className="text-sm font-semibold py-2 px-4 rounded-lg text-gray-500 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarVersao}
                disabled={salvandoVersao || !novaVersaoNome.trim()}
                className="text-sm font-semibold py-2 px-4 rounded-lg bg-[#fb4d06] text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {salvandoVersao ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CampoNumero({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type="number"
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
