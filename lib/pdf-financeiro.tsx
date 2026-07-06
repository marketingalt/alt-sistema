import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Constantes ─────────────────────────────────────────────────────────────
const EMPRESA = "ALT. MARKETING E PUBLICIDADE";
const CNPJ = "45.025.544/0001-92";

// ─── Estilos base ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pagePortrait: {
    fontFamily: "Helvetica",
    fontSize: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  pageLandscape: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    backgroundColor: "#ffffff",
    paddingHorizontal: 25,
    paddingVertical: 16,
  },
  // Cabeçalho do relatório
  headerBox: {
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a2e",
    paddingBottom: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1a1a2e" },
  headerSub: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  headerRight: { fontSize: 7, color: "#6b7280", textAlign: "right" },
  // Tabela
  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thRight: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  rowAlt: { backgroundColor: "#f9fafb" },
  td: { fontSize: 7.5, color: "#374151" },
  tdRight: { fontSize: 7.5, color: "#374151", textAlign: "right" },
  tdPos: { fontSize: 7.5, color: "#059669", textAlign: "right" },
  tdNeg: { fontSize: 7.5, color: "#dc2626", textAlign: "right" },
  // Rodapé da tabela
  totalRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1.5,
    borderTopColor: "#374151",
    backgroundColor: "#f3f4f6",
  },
  totalLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#374151" },
  totalValue: { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" },
  // Rodapé da página
  footer: {
    position: "absolute",
    bottom: 12,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#d1d5db",
    paddingTop: 4,
    fontSize: 6.5,
    color: "#9ca3af",
  },
  // Resumo / KPIs
  kpiBox: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  kpiCard: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#e5e7eb",
  },
  kpiLabel: { fontSize: 7, color: "#6b7280", marginBottom: 2 },
  kpiValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  // Informações complementares
  infoLine: { fontSize: 7, color: "#6b7280", marginBottom: 2 },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtData(d: string): string {
  if (!d) return "";
  const p = d.split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// ─── Fluxo de Caixa ──────────────────────────────────────────────────────────
interface LinhaFluxoCaixa {
  data: string;
  modalidade: string;
  banco: string;
  area: string;
  categoria: string;
  os: string;
  obs: string;
  valor: number;
  saldoCorrido: number | null;
}

interface PdfFluxoCaixaProps {
  titulo: string;
  periodo: string;
  linhas: LinhaFluxoCaixa[];
  entradas: number;
  saidas: number;
  resultado: number;
  saldoFinal: number;
}

export function PdfFluxoCaixa({ titulo, periodo, linhas, entradas, saidas, resultado, saldoFinal }: PdfFluxoCaixaProps) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
        <View style={styles.headerBox}>
          <View>
            <Text style={styles.headerTitle}>{titulo}</Text>
            <Text style={styles.headerSub}>{EMPRESA} — {CNPJ}</Text>
            <Text style={styles.headerSub}>Período: {periodo}</Text>
          </View>
          <View>
            <Text style={styles.headerRight}>Gerado em: {geradoEm}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.kpiBox}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Entradas</Text>
            <Text style={{ ...styles.kpiValue, color: "#059669" }}>{fmtMoeda(entradas)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Saídas</Text>
            <Text style={{ ...styles.kpiValue, color: "#dc2626" }}>{fmtMoeda(saidas)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Resultado</Text>
            <Text style={{ ...styles.kpiValue, color: resultado >= 0 ? "#059669" : "#dc2626" }}>{fmtMoeda(resultado)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Saldo Final</Text>
            <Text style={{ ...styles.kpiValue, color: saldoFinal >= 0 ? "#059669" : "#dc2626" }}>{fmtMoeda(saldoFinal)}</Text>
          </View>
        </View>

        {/* Tabela */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.th, width: "10%" }}>Data</Text>
            <Text style={{ ...styles.th, width: "11%" }}>Modalidade</Text>
            <Text style={{ ...styles.th, width: "12%" }}>Banco</Text>
            <Text style={{ ...styles.th, width: "10%" }}>Área</Text>
            <Text style={{ ...styles.th, width: "19%" }}>Categoria</Text>
            <Text style={{ ...styles.th, width: "8%" }}>OS</Text>
            <Text style={{ ...styles.th, width: "15%" }}>Observação</Text>
            <Text style={{ ...styles.thRight, width: "8%" }}>Valor</Text>
            <Text style={{ ...styles.thRight, width: "7%" }}>Saldo</Text>
          </View>
          {linhas.map((l, i) => (
            <View key={i} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}>
              <Text style={{ ...styles.td, width: "10%" }}>{fmtData(l.data)}</Text>
              <Text style={{ ...styles.td, width: "11%" }}>{l.modalidade}</Text>
              <Text style={{ ...styles.td, width: "12%" }}>{l.banco}</Text>
              <Text style={{ ...styles.td, width: "10%" }}>{l.area}</Text>
              <Text style={{ ...styles.td, width: "19%" }}>{l.categoria}</Text>
              <Text style={{ ...styles.td, width: "8%" }}>{l.os}</Text>
              <Text style={{ ...styles.td, width: "15%" }}>{l.obs}</Text>
              <Text style={{ ...(l.valor >= 0 ? styles.tdPos : styles.tdNeg), width: "8%" }}>{fmtMoeda(l.valor)}</Text>
              <Text style={{ ...styles.tdRight, width: "7%" }}>{l.saldoCorrido !== null ? fmtMoeda(l.saldoCorrido) : ""}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={{ ...styles.totalLabel, width: "85%" }}>Total do período</Text>
            <Text style={{ ...styles.totalValue, width: "8%", color: resultado >= 0 ? "#059669" : "#dc2626" }}>{fmtMoeda(resultado)}</Text>
            <Text style={{ width: "7%" }} />
          </View>
        </View>

        <Text style={styles.footer}>
          <Text>{EMPRESA} — Relatório Financeiro</Text>
          <Text>Página 1</Text>
        </Text>
      </Page>
    </Document>
  );
}

// ─── Contas a Pagar ──────────────────────────────────────────────────────────
interface LinhaContaPagar {
  vencimento: string;
  pagamento: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  modalidade: string;
  banco: string;
  area: string;
  categoria: string;
  status: string;
  os: string;
  obs: string;
}

interface PdfContasPagarProps {
  titulo: string;
  periodo: string;
  linhas: LinhaContaPagar[];
  totalMes: number;
  totalPendente: number;
  totalPago: number;
  totalVencido: number;
}

export function PdfContasPagar({ titulo, periodo, linhas, totalMes, totalPendente, totalPago, totalVencido }: PdfContasPagarProps) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <Document>
      <Page size="A4" style={styles.pagePortrait}>
        <View style={styles.headerBox}>
          <View>
            <Text style={styles.headerTitle}>{titulo}</Text>
            <Text style={styles.headerSub}>{EMPRESA} — {CNPJ}</Text>
            <Text style={styles.headerSub}>Período: {periodo}</Text>
          </View>
          <View>
            <Text style={styles.headerRight}>Gerado em: {geradoEm}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.kpiBox}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total do Mês</Text>
            <Text style={{ ...styles.kpiValue, color: "#374151" }}>{fmtMoeda(totalMes)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pendente</Text>
            <Text style={{ ...styles.kpiValue, color: "#ca8a04" }}>{fmtMoeda(totalPendente)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Vencido</Text>
            <Text style={{ ...styles.kpiValue, color: "#dc2626" }}>{fmtMoeda(totalVencido)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pago</Text>
            <Text style={{ ...styles.kpiValue, color: "#059669" }}>{fmtMoeda(totalPago)}</Text>
          </View>
        </View>

        {/* Tabela */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.th, width: "12%" }}>Vencimento</Text>
            <Text style={{ ...styles.th, width: "18%" }}>Fornecedor</Text>
            <Text style={{ ...styles.th, width: "28%" }}>Descrição</Text>
            <Text style={{ ...styles.th, width: "10%" }}>Categoria</Text>
            <Text style={{ ...styles.thRight, width: "12%" }}>Valor</Text>
            <Text style={{ ...styles.th, width: "10%" }}>Status</Text>
            <Text style={{ ...styles.th, width: "10%" }}>OS</Text>
          </View>
          {linhas.map((l, i) => (
            <View key={i} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}>
              <Text style={{ ...styles.td, width: "12%" }}>{fmtData(l.vencimento)}</Text>
              <Text style={{ ...styles.td, width: "18%" }}>{l.fornecedor}</Text>
              <Text style={{ ...styles.td, width: "28%" }}>{l.descricao}</Text>
              <Text style={{ ...styles.td, width: "10%" }}>{l.categoria}</Text>
              <Text style={{ ...styles.tdRight, width: "12%" }}>{fmtMoeda(l.valor)}</Text>
              <Text style={{ ...styles.td, width: "10%" }}>{l.status}</Text>
              <Text style={{ ...styles.td, width: "10%" }}>{l.os}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={{ ...styles.totalLabel, width: "68%" }}>Total do período</Text>
            <Text style={{ ...styles.totalValue, width: "12%", color: "#374151" }}>{fmtMoeda(totalMes)}</Text>
            <Text style={{ width: "20%" }} />
          </View>
        </View>

        <Text style={styles.footer}>
          <Text>{EMPRESA} — Relatório Financeiro</Text>
          <Text>Gerado em: {geradoEm}</Text>
        </Text>
      </Page>
    </Document>
  );
}

// ─── Contas a Receber ────────────────────────────────────────────────────────
interface LinhaContaReceber {
  cliente: string;
  job: string;
  responsavel: string;
  statusJob: string;
  valorAprovado: number;
  custos: number;
  aPagar: number;
  rentabilidade: number;
  statusNota: string;
  numeroNota: string;
  emissao: string;
  vencimento: string;
  pago: boolean;
  os: string;
}

interface PdfContasReceberProps {
  titulo: string;
  periodo: string;
  linhas: LinhaContaReceber[];
  totalAprovado: number;
  totalCustos: number;
  aReceber: number;
  recebido: number;
  rentabilidadeMedia: number;
}

export function PdfContasReceber({ titulo, periodo, linhas, totalAprovado, totalCustos, aReceber, recebido, rentabilidadeMedia }: PdfContasReceberProps) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
        <View style={styles.headerBox}>
          <View>
            <Text style={styles.headerTitle}>{titulo}</Text>
            <Text style={styles.headerSub}>{EMPRESA} — {CNPJ}</Text>
            <Text style={styles.headerSub}>Período: {periodo}</Text>
          </View>
          <View>
            <Text style={styles.headerRight}>Gerado em: {geradoEm}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.kpiBox}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Valor Aprovado</Text>
            <Text style={{ ...styles.kpiValue, color: "#374151" }}>{fmtMoeda(totalAprovado)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Custos</Text>
            <Text style={{ ...styles.kpiValue, color: "#dc2626" }}>{fmtMoeda(totalCustos)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>A Receber</Text>
            <Text style={{ ...styles.kpiValue, color: "#2563eb" }}>{fmtMoeda(aReceber)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Recebido</Text>
            <Text style={{ ...styles.kpiValue, color: "#059669" }}>{fmtMoeda(recebido)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Rentab. Média</Text>
            <Text style={{ ...styles.kpiValue, color: rentabilidadeMedia >= 30 ? "#059669" : "#ca8a04" }}>{rentabilidadeMedia.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Tabela */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.th, width: "14%" }}>Cliente</Text>
            <Text style={{ ...styles.th, width: "14%" }}>Job</Text>
            <Text style={{ ...styles.th, width: "10%" }}>Responsável</Text>
            <Text style={{ ...styles.th, width: "9%" }}>Status Job</Text>
            <Text style={{ ...styles.thRight, width: "11%" }}>V. Aprovado</Text>
            <Text style={{ ...styles.thRight, width: "9%" }}>Custos</Text>
            <Text style={{ ...styles.thRight, width: "11%" }}>A Pagar</Text>
            <Text style={{ ...styles.thRight, width: "7%" }}>Rentab.</Text>
            <Text style={{ ...styles.th, width: "8%" }}>Status Nota</Text>
            <Text style={{ ...styles.th, width: "7%" }}>Pago</Text>
          </View>
          {linhas.map((l, i) => (
            <View key={i} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}>
              <Text style={{ ...styles.td, width: "14%" }}>{l.cliente}</Text>
              <Text style={{ ...styles.td, width: "14%" }}>{l.job}</Text>
              <Text style={{ ...styles.td, width: "10%" }}>{l.responsavel}</Text>
              <Text style={{ ...styles.td, width: "9%" }}>{l.statusJob}</Text>
              <Text style={{ ...styles.tdRight, width: "11%" }}>{fmtMoeda(l.valorAprovado)}</Text>
              <Text style={{ ...styles.tdRight, width: "9%" }}>{fmtMoeda(l.custos)}</Text>
              <Text style={{ ...styles.tdRight, width: "11%", color: l.aPagar >= 0 ? "#059669" : "#dc2626" }}>{fmtMoeda(l.aPagar)}</Text>
              <Text style={{ ...styles.tdRight, width: "7%" }}>{l.rentabilidade.toFixed(1)}%</Text>
              <Text style={{ ...styles.td, width: "8%" }}>{l.statusNota}</Text>
              <Text style={{ ...styles.td, width: "7%" }}>{l.pago ? "Sim" : "Não"}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={{ ...styles.totalLabel, width: "47%" }}>Total</Text>
            <Text style={{ ...styles.totalValue, width: "11%" }}>{fmtMoeda(totalAprovado)}</Text>
            <Text style={{ ...styles.totalValue, width: "9%" }}>{fmtMoeda(totalCustos)}</Text>
            <Text style={{ ...styles.totalValue, width: "11%" }}>{fmtMoeda(totalAprovado - totalCustos)}</Text>
            <Text style={{ ...styles.totalValue, width: "7%" }}>{rentabilidadeMedia.toFixed(1)}%</Text>
            <Text style={{ width: "15%" }} />
          </View>
        </View>

        <Text style={styles.footer}>
          <Text>{EMPRESA} — Relatório Financeiro</Text>
          <Text>Gerado em: {geradoEm}</Text>
        </Text>
      </Page>
    </Document>
  );
}
