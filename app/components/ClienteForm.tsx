"use client";

import type { Cliente, FormaPagamento, StatusCliente } from "@/app/types";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const FORMAS_PAGAMENTO: FormaPagamento[] = ["Cartão Corporativo", "Boleto", "TED", "PIX"];
const STATUS_OPCOES: StatusCliente[] = ["Ativo", "Inativo", "Inadimplente"];

const STATUS_CORES: Record<StatusCliente, string> = {
  "Ativo": "text-green-700 bg-green-50 border-green-200",
  "Inativo": "text-gray-600 bg-gray-50 border-gray-200",
  "Inadimplente": "text-red-700 bg-red-50 border-red-200",
};

interface Props {
  dados: Partial<Cliente>;
  onChange: (campo: keyof Cliente, valor: unknown) => void;
  showRestritoToggle?: boolean;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{titulo}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = "text", full = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type={type}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function ClienteForm({ dados, onChange, showRestritoToggle }: Props) {
  const v = (c: keyof Cliente) => (dados[c] as string) || "";
  const mesmoFinanceiro = dados.mesmoContatoFinanceiro !== false;

  function togglePagamento(forma: FormaPagamento) {
    const atual = (dados.formasPagamento || []) as FormaPagamento[];
    const novo = atual.includes(forma) ? atual.filter((f) => f !== forma) : [...atual, forma];
    onChange("formasPagamento", novo);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Identificação e Faturamento */}
      <Secao titulo="Identificação e Faturamento">
        <Campo label="Nome da Empresa" value={v("nomeEmpresa")} onChange={(val) => onChange("nomeEmpresa", val)} placeholder="Nome comercial" />
        <Campo label="Razão Social" value={v("razaoSocial")} onChange={(val) => onChange("razaoSocial", val)} placeholder="Razão Social Ltda." />
        <Campo label="CNPJ" value={v("cnpj")} onChange={(val) => onChange("cnpj", val)} placeholder="00.000.000/0000-00" />
        <Campo label="Inscrição Estadual" value={v("inscricaoEstadual")} onChange={(val) => onChange("inscricaoEstadual", val)} placeholder="Opcional" />
      </Secao>

      {/* Contato Direto */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Contato Direto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nome do contato" value={v("nomeContato")} onChange={(val) => onChange("nomeContato", val)} placeholder="Ex: Ana Souza" />
          <Campo label="WhatsApp" value={v("whatsappContato")} onChange={(val) => onChange("whatsappContato", val)} placeholder="(11) 99999-9999" type="tel" />
          <Campo label="Email" value={v("emailContato")} onChange={(val) => onChange("emailContato", val)} placeholder="contato@empresa.com" type="email" full />

          {/* Toggle mesmo contato financeiro */}
          <div className="col-span-2 mt-1">
            <label className="flex items-center gap-3 cursor-pointer group w-fit">
              <div
                onClick={() => onChange("mesmoContatoFinanceiro", !mesmoFinanceiro)}
                className={`w-10 h-5 rounded-full transition-colors relative ${mesmoFinanceiro ? "bg-[#fb4d06]" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${mesmoFinanceiro ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm text-gray-600">
                {mesmoFinanceiro
                  ? "Este é o mesmo contato para informações financeiras"
                  : "Contato financeiro é diferente"}
              </span>
            </label>
          </div>
        </div>

        {/* Contato Financeiro — só aparece se for diferente */}
        {!mesmoFinanceiro && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contato Financeiro</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Nome do contato financeiro" value={v("nomeContatoFinanceiro")} onChange={(val) => onChange("nomeContatoFinanceiro", val)} placeholder="Ex: Carlos Lima" />
              <Campo label="WhatsApp financeiro" value={v("whatsappContatoFinanceiro")} onChange={(val) => onChange("whatsappContatoFinanceiro", val)} placeholder="(11) 99999-9999" type="tel" />
              <Campo label="Email financeiro" value={v("emailContatoFinanceiro")} onChange={(val) => onChange("emailContatoFinanceiro", val)} placeholder="financeiro@empresa.com" type="email" full />
            </div>
          </div>
        )}
      </div>

      {/* Localização e Entrega */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Localização e Entrega</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Endereço (Rua, número)" value={v("endereco")} onChange={(val) => onChange("endereco", val)} placeholder="Rua das Flores, 123" full />
          <Campo label="Bairro" value={v("bairro")} onChange={(val) => onChange("bairro", val)} placeholder="Centro" />
          <Campo label="CEP" value={v("cep")} onChange={(val) => onChange("cep", val)} placeholder="00000-000" />
          <Campo label="Cidade" value={v("cidade")} onChange={(val) => onChange("cidade", val)} placeholder="São Paulo" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              value={v("estado")} onChange={(e) => onChange("estado", e.target.value)}>
              <option value="">Selecione...</option>
              {ESTADOS.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Financeiro */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Financeiro e Gestão</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Formas de pagamento */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-2">Forma de Pagamento Preferencial</label>
            <div className="flex flex-wrap gap-2">
              {FORMAS_PAGAMENTO.map((forma) => {
                const selecionado = (dados.formasPagamento || []).includes(forma);
                return (
                  <button
                    key={forma}
                    type="button"
                    onClick={() => togglePagamento(forma)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                      selecionado
                        ? "bg-[#fb4d06] text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#fb4d06]/30 hover:text-[#fb4d06]"
                    }`}
                  >
                    {forma === "Cartão Corporativo" && "💳 "}
                    {forma === "Boleto" && "🧾 "}
                    {forma === "TED" && "🏦 "}
                    {forma === "PIX" && "⚡ "}
                    {forma}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prazo de pagamento padrão */}
          <div className="col-span-2 sm:col-span-1">
            <Campo
              label="Prazo de Pagamento (padrão deste cliente)"
              value={v("prazoPagamento")}
              onChange={(val) => onChange("prazoPagamento", val)}
              placeholder="Ex: 30 dias, 50% entrada + 50% na entrega..."
            />
          </div>

          {/* Status */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-2">Status do Cliente</label>
            <div className="flex gap-2">
              {STATUS_OPCOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange("status", s)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                    (dados.status || "Ativo") === s
                      ? STATUS_CORES[s] + " border-current"
                      : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Restrito ao Financeiro */}
        {showRestritoToggle && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer group w-fit">
              <div
                onClick={() => onChange("restritoFinanceiro", !dados.restritoFinanceiro)}
                className={`w-10 h-5 rounded-full transition-colors relative ${dados.restritoFinanceiro ? "bg-[#fb4d06]" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dados.restritoFinanceiro ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">🔒 Restrito ao Financeiro</span>
                <p className="text-xs text-gray-400 mt-0.5">Apenas usuários com acesso ao módulo Financeiro poderão ver e editar este cliente</p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
