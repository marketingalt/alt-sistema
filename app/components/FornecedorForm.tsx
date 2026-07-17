"use client";

import type { Fornecedor } from "@/app/types";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const CATEGORIAS = [
  "Brindes e Produtos Personalizados",
  "Confecção e Vestuário",
  "Gráfica e Impressão",
  "Embalagens",
  "Eletrônicos e Tecnologia",
  "Papelaria",
  "Moveis e Decoração",
  "Alimentação",
  "Logística e Transporte",
  "Outro",
];

interface Props {
  dados: Partial<Fornecedor>;
  onChange: (campo: keyof Fornecedor, valor: unknown) => void;
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
      <input
        type={type}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CampoTexto({ label, value, onChange, placeholder, full = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 resize-none min-h-[80px]"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function FornecedorForm({ dados, onChange, showRestritoToggle }: Props) {
  const v = (campo: keyof Fornecedor) => (dados[campo] as string) || "";

  return (
    <div className="flex flex-col gap-5">
      {/* Identificação */}
      <Secao titulo="Identificação">
        <Campo label="Nome Fantasia" value={v("nomeFantasia")} onChange={(val) => onChange("nomeFantasia", val)} placeholder="Ex: Brindes Top" />
        <Campo label="Razão Social" value={v("razaoSocial")} onChange={(val) => onChange("razaoSocial", val)} placeholder="Ex: Brindes Top Ltda." />
        <Campo label="CNPJ" value={v("cnpj")} onChange={(val) => onChange("cnpj", val)} placeholder="00.000.000/0000-00" />
        <Campo label="Inscrição Estadual" value={v("inscricaoEstadual")} onChange={(val) => onChange("inscricaoEstadual", val)} placeholder="Opcional" />
      </Secao>

      {/* Contatos */}
      <Secao titulo="Contatos Diretos">
        <Campo label="Nome do Vendedor / Atendente" value={v("nomeContato")} onChange={(val) => onChange("nomeContato", val)} placeholder="Ex: João Silva" />
        <Campo label="Email Corporativo" value={v("emailCorporativo")} onChange={(val) => onChange("emailCorporativo", val)} type="email" placeholder="vendas@empresa.com" />
        <Campo label="WhatsApp" value={v("whatsapp")} onChange={(val) => onChange("whatsapp", val)} placeholder="(11) 99999-9999" type="tel" />
      </Secao>

      {/* Especificações */}
      <Secao titulo="Especificações de Fornecimento">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Categoria do Setor</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
            value={v("categoria")}
            onChange={(e) => onChange("categoria", e.target.value)}
          >
            <option value="">Selecione...</option>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Campo label="Valor de Pedido Mínimo" value={v("pedidoMinimo")} onChange={(val) => onChange("pedidoMinimo", val)} placeholder="Ex: R$ 500,00 ou Sem mínimo" />
        <CampoTexto label="Produtos / Serviços Fornecidos" value={v("produtos")} onChange={(val) => onChange("produtos", val)} placeholder="Ex: Bonés, camisetas, canecas personalizadas..." full />
      </Secao>

      {/* Logística */}
      <Secao titulo="Logística e Prazos">
        <Campo label="Prazo Médio de Entrega (dias)" value={v("prazoEntregaDias")} onChange={(val) => onChange("prazoEntregaDias", val)} placeholder="Ex: 15" type="number" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
            value={v("estado")}
            onChange={(e) => onChange("estado", e.target.value)}
          >
            <option value="">Selecione...</option>
            {ESTADOS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
        <Campo label="Cidade" value={v("cidade")} onChange={(val) => onChange("cidade", val)} placeholder="Ex: São Paulo" />
        <Campo label="Endereço Completo" value={v("endereco")} onChange={(val) => onChange("endereco", val)} placeholder="Rua, número, bairro, CEP" />
      </Secao>

      {/* Financeiro */}
      <Secao titulo="Financeiro e Gestão">
        <CampoTexto label="Condições de Pagamento" value={v("condicoesPagamento")} onChange={(val) => onChange("condicoesPagamento", val)} placeholder="Ex: 30/60 dias, boleto, à vista 5% desconto..." full />
        <CampoTexto label="Dados Bancários / Chave PIX" value={v("dadosBancarios")} onChange={(val) => onChange("dadosBancarios", val)} placeholder="Banco, agência, conta ou chave PIX..." full />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status do Cadastro</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
            value={v("status") || "Ativo"}
            onChange={(e) => onChange("status", e.target.value)}
          >
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
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
                <p className="text-xs text-gray-400 mt-0.5">Apenas usuários com acesso ao módulo Financeiro poderão ver e editar este fornecedor</p>
              </div>
            </label>
          </div>
        )}
      </Secao>
    </div>
  );
}
