import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Orcamento } from "@/app/types";

const estilosBase = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 16,
    background: "#1a1a2e",
  },
  headerLeft: { flexDirection: "column" },
  logoText: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#D4AF37" },
  logoSub: { fontSize: 8, color: "#ffffff", opacity: 0.7 },
  headerRight: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  infoBox: {
    marginHorizontal: 30,
    marginTop: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 10,
  },
  infoRow: { flexDirection: "row", gap: 40, marginBottom: 4 },
  infoLabel: { fontSize: 8, color: "#6b7280", width: 90 },
  infoValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827", flex: 1 },
  obs: { fontSize: 8, color: "#dc2626", marginTop: 4 },
  freteBox: {
    marginHorizontal: 30,
    marginBottom: 10,
    backgroundColor: "#fef9c3",
    padding: 6,
    borderRadius: 3,
  },
  freteText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#854d0e" },
  table: { marginHorizontal: 30, marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  thKit: { width: 80, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thRef: { width: 60, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thItem: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thAcab: { width: 65, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thDesc: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thQtd: { width: 40, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  thVal: { width: 55, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  thTot: { width: 65, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowAlt: { backgroundColor: "#f9fafb" },
  tdKit: { width: 80, fontSize: 8, color: "#4b5563" },
  tdRef: { width: 60, fontSize: 8, color: "#4b5563" },
  tdItem: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#111827" },
  tdAcab: { width: 65, fontSize: 8, color: "#4b5563" },
  tdDesc: { flex: 2, fontSize: 7.5, color: "#4b5563", lineHeight: 1.4 },
  tdQtd: { width: 40, fontSize: 8, color: "#374151", textAlign: "right" },
  tdVal: { width: 55, fontSize: 8, color: "#374151", textAlign: "right" },
  tdTot: { width: 65, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b21a8", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 30,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#6b21a8",
  },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#374151" },
  totalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#6b21a8" },
});

function fmt(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function HeaderPdf({ orcamento }: { orcamento: Orcamento }) {
  return (
    <>
      <View style={estilosBase.header}>
        <View style={estilosBase.headerLeft}>
          <Text style={estilosBase.logoText}>alt.</Text>
          <Text style={estilosBase.logoSub}>marketing</Text>
        </View>
        <Text style={estilosBase.headerRight}>ORÇ. NÚMERO: {orcamento.numero}</Text>
      </View>

      <View style={estilosBase.infoBox}>
        <View style={estilosBase.infoRow}>
          <Text style={estilosBase.infoLabel}>CLIENTE</Text>
          <Text style={estilosBase.infoValue}>{orcamento.cliente}</Text>
          <Text style={estilosBase.infoLabel}>PRAZO DE PAGAMENTO:</Text>
          <Text style={estilosBase.infoValue}>{orcamento.prazoPagamento}</Text>
        </View>
        <View style={estilosBase.infoRow}>
          <Text style={estilosBase.infoLabel}>SOLICITANTE</Text>
          <Text style={estilosBase.infoValue}>{orcamento.solicitante}</Text>
          <Text style={estilosBase.infoLabel}>PRAZO ENTREGA:</Text>
          <Text style={estilosBase.infoValue}>{orcamento.prazoEntrega}</Text>
        </View>
        <View style={estilosBase.infoRow}>
          <Text style={estilosBase.infoLabel}>DATA DO ORÇAMENTO</Text>
          <Text style={estilosBase.infoValue}>{orcamento.dataOrcamento}</Text>
        </View>
        {orcamento.observacoes ? (
          <Text style={estilosBase.obs}>OBS.: {orcamento.observacoes}</Text>
        ) : null}
      </View>

      {orcamento.frete ? (
        <View style={estilosBase.freteBox}>
          <Text style={estilosBase.freteText}>FRETE: {orcamento.frete}</Text>
        </View>
      ) : null}
    </>
  );
}

// PDF 1 — Especificações técnicas (sem valores)
export function PdfEspecificacoes({ orcamento }: { orcamento: Orcamento }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={estilosBase.page}>
        <HeaderPdf orcamento={orcamento} />

        <View style={estilosBase.table}>
          <View style={estilosBase.tableHeader}>
            <Text style={estilosBase.thKit}>KIT</Text>
            <Text style={estilosBase.thRef}>REFERÊNCIA</Text>
            <Text style={estilosBase.thItem}>ITEM</Text>
            <Text style={estilosBase.thAcab}>ACABAMENTO</Text>
            <Text style={estilosBase.thDesc}>DESCRIÇÃO</Text>
            <Text style={estilosBase.thQtd}>QTD.</Text>
          </View>

          {orcamento.itens.map((item, idx) => (
            <View key={item.id} style={[estilosBase.row, idx % 2 !== 0 ? estilosBase.rowAlt : {}]} wrap={false}>
              <Text style={estilosBase.tdKit}>{item.kit}</Text>
              <Text style={estilosBase.tdRef}>{item.referencia}</Text>
              <Text style={estilosBase.tdItem}>{item.item}</Text>
              <Text style={estilosBase.tdAcab}>{item.acabamento}</Text>
              <Text style={estilosBase.tdDesc}>{item.descricao}</Text>
              <Text style={estilosBase.tdQtd}>{item.quantidade}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

// PDF 2 — Lista de valores + especificações
export function PdfValores({ orcamento }: { orcamento: Orcamento }) {
  const total = orcamento.itens.reduce((a, i) => a + (i.total || 0), 0);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={estilosBase.page}>
        <HeaderPdf orcamento={orcamento} />

        <View style={estilosBase.table}>
          <View style={estilosBase.tableHeader}>
            <Text style={estilosBase.thKit}>KIT</Text>
            <Text style={estilosBase.thRef}>REFERÊNCIA</Text>
            <Text style={estilosBase.thItem}>ITEM</Text>
            <Text style={estilosBase.thAcab}>ACABAMENTO</Text>
            <Text style={estilosBase.thDesc}>DESCRIÇÃO</Text>
            <Text style={estilosBase.thQtd}>QTD.</Text>
            <Text style={estilosBase.thVal}>VALOR UN.</Text>
            <Text style={estilosBase.thTot}>TOTAL (R$)</Text>
          </View>

          {orcamento.itens.map((item, idx) => (
            <View key={item.id} style={[estilosBase.row, idx % 2 !== 0 ? estilosBase.rowAlt : {}]} wrap={false}>
              <Text style={estilosBase.tdKit}>{item.kit}</Text>
              <Text style={estilosBase.tdRef}>{item.referencia}</Text>
              <Text style={estilosBase.tdItem}>{item.item}</Text>
              <Text style={estilosBase.tdAcab}>{item.acabamento}</Text>
              <Text style={estilosBase.tdDesc}>{item.descricao}</Text>
              <Text style={estilosBase.tdQtd}>{item.quantidade}</Text>
              <Text style={estilosBase.tdVal}>{fmt(item.valorUnitario)}</Text>
              <Text style={estilosBase.tdTot}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={estilosBase.totalRow}>
          <Text style={estilosBase.totalLabel}>TOTAL GERAL</Text>
          <Text style={estilosBase.totalValue}>{fmt(total)}</Text>
        </View>
      </Page>
    </Document>
  );
}
