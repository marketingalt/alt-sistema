import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Orcamento } from "@/app/types";

const ALT_EMPRESA = "ALT. MARKETING E PUBLICIDADE";
const ALT_CNPJ = "45.025.544/0001-92";

function toImgSrc(b64?: string): Buffer | string | undefined {
  if (!b64) return undefined;
  if (b64.startsWith("data:")) {
    return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ""), "base64");
  }
  if (b64.startsWith("http://") || b64.startsWith("https://")) {
    return b64;
  }
  return Buffer.from(b64, "base64");
}

// ─── Estilos compartilhados (PDFs do cliente — sem referência) ───────────────
const base = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 16,
    backgroundColor: "#1a1a2e",
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
  // Colunas cliente (sem referência)
  thKit:  { width: 80,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thItem: { flex: 1,    fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thAcab: { width: 70,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thDesc: { flex: 2,    fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thQtd:  { width: 40,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  thVal:  { width: 60,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  thTot:  { width: 70,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowAlt: { backgroundColor: "#f9fafb" },
  tdKit:  { width: 80,  fontSize: 8, color: "#4b5563" },
  tdItem: { flex: 1,    fontSize: 8, fontFamily: "Helvetica-Bold", color: "#111827" },
  tdAcab: { width: 70,  fontSize: 8, color: "#4b5563" },
  tdDesc: { flex: 2,    fontSize: 7.5, color: "#4b5563", lineHeight: 1.4 },
  tdQtd:  { width: 40,  fontSize: 8, color: "#374151", textAlign: "right" },
  tdVal:  { width: 60,  fontSize: 8, color: "#374151", textAlign: "right" },
  tdTot:  { width: 70,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b21a8", textAlign: "right" },
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

// ─── Estilos da OS (documento interno) ───────────────────────────────────────
const os = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#ffffff", paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 14,
    backgroundColor: "#111827",
  },
  logoText:   { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#D4AF37" },
  logoSub:    { fontSize: 7, color: "#9ca3af" },
  headerRight: { alignItems: "flex-end" },
  osTitle:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  osNumero:   { fontSize: 9, color: "#9ca3af", marginTop: 2 },
  badge: {
    marginHorizontal: 30,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badgeTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  cell: { width: "33%", marginBottom: 6 },
  cellLabel: { fontSize: 7, color: "#9ca3af", marginBottom: 1 },
  cellValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827" },
  notaBox: {
    marginHorizontal: 30,
    marginBottom: 8,
    flexDirection: "row",
    gap: 6,
  },
  notaTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#111827",
    borderRadius: 3,
  },
  notaTagText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  obsBox: {
    marginHorizontal: 30,
    marginBottom: 10,
    backgroundColor: "#fff7ed",
    borderLeftWidth: 3,
    borderLeftColor: "#f97316",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  obsText: { fontSize: 8, color: "#92400e" },
  table: { marginHorizontal: 30, marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  // Colunas OS (com referência — uso interno)
  thKit:  { width: 70,  fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thRef:  { width: 65,  fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#d1d5db" },
  thItem: { flex: 1,    fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thAcab: { width: 65,  fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thDesc: { flex: 2,    fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  thQtd:  { width: 40,  fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  rowAlt: { backgroundColor: "#f9fafb" },
  tdKit:  { width: 70,  fontSize: 8, color: "#374151" },
  tdRef:  { width: 65,  fontSize: 7.5, color: "#6b7280", fontFamily: "Helvetica-Oblique" },
  tdItem: { flex: 1,    fontSize: 8, fontFamily: "Helvetica-Bold", color: "#111827" },
  tdAcab: { width: 65,  fontSize: 8, color: "#374151" },
  tdDesc: { flex: 2,    fontSize: 7.5, color: "#4b5563", lineHeight: 1.4 },
  tdQtd:  { width: 40,  fontSize: 8, fontFamily: "Helvetica-Bold", color: "#111827", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: "#9ca3af" },
});

function fmt(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function HeaderCliente({ orcamento, logoBase64 }: { orcamento: Orcamento; logoBase64?: string }) {
  return (
    <>
      <View style={base.header}>
        <View style={base.headerLeft}>
          {logoBase64 ? (
            <Image src={toImgSrc(logoBase64)} style={{ maxWidth: 100, maxHeight: 32 }} />
          ) : (
            <>
              <Text style={base.logoText}>alt.</Text>
              <Text style={base.logoSub}>marketing</Text>
            </>
          )}
        </View>
        <Text style={base.headerRight}>ORÇ. NÚMERO: {orcamento.numero}</Text>
      </View>

      <View style={base.infoBox}>
        <View style={base.infoRow}>
          <Text style={base.infoLabel}>CLIENTE</Text>
          <Text style={base.infoValue}>{orcamento.cliente}</Text>
          <Text style={base.infoLabel}>PRAZO DE PAGAMENTO:</Text>
          <Text style={base.infoValue}>{orcamento.prazoPagamento}</Text>
        </View>
        <View style={base.infoRow}>
          <Text style={base.infoLabel}>SOLICITANTE</Text>
          <Text style={base.infoValue}>{orcamento.solicitante}</Text>
          <Text style={base.infoLabel}>PRAZO ENTREGA:</Text>
          <Text style={base.infoValue}>{orcamento.prazoEntrega}</Text>
        </View>
        <View style={base.infoRow}>
          <Text style={base.infoLabel}>DATA DO ORÇAMENTO</Text>
          <Text style={base.infoValue}>{orcamento.dataOrcamento}</Text>
        </View>
        {orcamento.observacoes ? (
          <Text style={base.obs}>OBS.: {orcamento.observacoes}</Text>
        ) : null}
      </View>

      {orcamento.frete ? (
        <View style={base.freteBox}>
          <Text style={base.freteText}>FRETE: {orcamento.frete}</Text>
        </View>
      ) : null}
    </>
  );
}

// ─── PDF 1 — Especificações (cliente, SEM referência) ────────────────────────
export function PdfEspecificacoes({ orcamento, logoBase64 }: { orcamento: Orcamento; logoBase64?: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={base.page}>
        <HeaderCliente orcamento={orcamento} logoBase64={logoBase64} />
        <View style={base.table}>
          <View style={base.tableHeader}>
            <Text style={base.thKit}>KIT</Text>
            <Text style={base.thItem}>ITEM</Text>
            <Text style={base.thAcab}>ACABAMENTO</Text>
            <Text style={base.thDesc}>DESCRIÇÃO</Text>
            <Text style={base.thQtd}>QTD.</Text>
          </View>
          {orcamento.itens.map((item, idx) => (
            <View key={item.id} style={[base.row, idx % 2 !== 0 ? base.rowAlt : {}]} wrap={false}>
              <Text style={base.tdKit}>{item.kit}</Text>
              <Text style={base.tdItem}>{item.item}</Text>
              <Text style={base.tdAcab}>{item.acabamento}</Text>
              <Text style={base.tdDesc}>{item.descricao}</Text>
              <Text style={base.tdQtd}>{item.quantidade}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

// ─── Estilos do novo PDF Valores ─────────────────────────────────────────────
const v = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, backgroundColor: "#ffffff", paddingBottom: 20 },

  // Header escuro
  header: { backgroundColor: "#1a1a2e" },
  headerInner: { flexDirection: "row", paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10 },
  headerCol: { flex: 1 },
  headerRow: { flexDirection: "row", marginBottom: 4 },
  hLabel: { fontSize: 6.5, color: "#9ca3af", width: 95 },
  hValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", flex: 1 },
  headerLogo: { width: 64, alignItems: "flex-end", justifyContent: "center" },
  vLogoText: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#D4AF37" },
  vLogoSub: { fontSize: 6.5, color: "#9ca3af" },
  strip: {
    flexDirection: "row",
    backgroundColor: "#111827",
    paddingHorizontal: 22,
    paddingVertical: 7,
  },
  stripItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  stripLabel: { fontSize: 7, color: "#9ca3af", marginRight: 4 },
  stripValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#f59e0b" },
  aprovBadge: {
    backgroundColor: "#14532d",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  aprovText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#86efac" },

  // Título laranja
  titleBar: { backgroundColor: "#fb4d06", paddingHorizontal: 22, paddingVertical: 9 },
  titleText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  // Tabela
  table: { marginHorizontal: 16, marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#374151",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#f3f4f6" },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    alignItems: "center",
    minHeight: 32,
  },
  rowAlt: { backgroundColor: "#f9fafb" },
  rowFrete: { backgroundColor: "#eff6ff" },
  td: { fontSize: 8, color: "#374151" },
  imgBox: { width: 36 },
  imgEl: { width: 28, height: 28 },
  imgEmpty: { width: 28, height: 28, backgroundColor: "#e5e7eb", borderRadius: 2 },

  // Seção interna
  sectionBar: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#374151",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionBarText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  // Total
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#fb4d06",
  },
  totalMeta: { alignItems: "flex-end", marginRight: 14 },
  totalMetaLine: { fontSize: 7.5, color: "#9ca3af" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#374151", marginRight: 14 },
  totalValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fb4d06" },

  // Honorários / Impostos
  honBox: {
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  honHeader: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  honHeaderText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#374151" },
  honRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  honRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  honLabel: { fontSize: 8, color: "#6b7280" },
  honPerc: { fontSize: 7.5, color: "#9ca3af", marginLeft: 3 },
  honValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#374151" },

  // Observações
  obsBar: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fef9c3",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
  },
  obsBarText: { fontSize: 7.5, color: "#854d0e" },
});

// ─── PDF 2 — Valores (cliente, SEM referência) ───────────────────────────────
export function PdfValores({ orcamento, logoBase64 }: { orcamento: Orcamento; logoBase64?: string }) {
  const totalProdutos = orcamento.itens.reduce((a, i) => a + (i.total || 0), 0);
  const totalServicos = orcamento.manuseio && orcamento.custoManuseio ? orcamento.custoManuseio : 0;
  const valorFrete = orcamento.freteValor || 0;
  const totalGeral = totalProdutos + totalServicos + valorFrete;
  const aprovado = orcamento.status === "Aprovado";
  const tiposNota = (orcamento.tiposNota || []).join(" + ") || "—";

  const titulo = [
    orcamento.cliente?.toUpperCase(),
    orcamento.nomeProjeto ? orcamento.nomeProjeto.toUpperCase() : null,
  ].filter(Boolean).join(": ");

  const freteVal = orcamento.frete &&
    !orcamento.frete.startsWith("CUSTO ADICIONAL")
      ? orcamento.frete
      : null;

  // Colunas fixas
  const W = { img: 36, acab: 58, kit: 52, qtd: 30, und: 26, vun: 74, vtot: 82 };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={v.page}>

        {/* ── Cabeçalho ── */}
        <View style={v.header}>
          <View style={v.headerInner}>
            <View style={v.headerCol}>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>EMPRESA:</Text>
                <Text style={v.hValue}>{ALT_EMPRESA}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>Nº DA PROPOSTA:</Text>
                <Text style={v.hValue}>{orcamento.numero}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>CLIENTE/END.:</Text>
                <Text style={v.hValue}>{orcamento.cliente}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>SOLICITANTE:</Text>
                <Text style={v.hValue}>{orcamento.solicitante || "—"}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>ELABORADA POR:</Text>
                <Text style={v.hValue}>{orcamento.responsavel || "—"}</Text>
              </View>
            </View>
            <View style={v.headerCol}>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>CNPJ:</Text>
                <Text style={v.hValue}>{ALT_CNPJ}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>DATA SOLICITAÇÃO:</Text>
                <Text style={v.hValue}>{orcamento.dataSolicitacao || "—"}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>DATA ELABORAÇÃO:</Text>
                <Text style={v.hValue}>{orcamento.dataOrcamento}</Text>
              </View>
              <View style={v.headerRow}>
                <Text style={v.hLabel}>TIPO DE NOTA:</Text>
                <Text style={v.hValue}>{tiposNota}</Text>
              </View>
            </View>
            <View style={v.headerLogo}>
              {logoBase64 ? (
                <Image src={toImgSrc(logoBase64)} style={{ maxWidth: 64, maxHeight: 48 }} />
              ) : (
                <>
                  <Text style={v.vLogoText}>alt.</Text>
                  <Text style={v.vLogoSub}>marketing</Text>
                </>
              )}
            </View>
          </View>

          {/* Faixa prazo + status */}
          <View style={v.strip}>
            <View style={v.stripItem}>
              <Text style={v.stripLabel}>PRAZO DE ENTREGA:</Text>
              <Text style={v.stripValue}>{orcamento.prazoEntrega}</Text>
            </View>
            <View style={v.stripItem}>
              <Text style={v.stripLabel}>PAGAMENTO:</Text>
              <Text style={v.stripValue}>{orcamento.prazoPagamento}</Text>
            </View>
            <View style={[v.stripItem, { flex: 0.6 }]}>
              <Text style={v.stripLabel}>APROVADO:</Text>
              {aprovado ? (
                <View style={v.aprovBadge}><Text style={v.aprovText}>SIM</Text></View>
              ) : (
                <Text style={v.stripValue}>{orcamento.status}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Título laranja ── */}
        <View style={v.titleBar}>
          <Text style={v.titleText}>{titulo || orcamento.cliente?.toUpperCase()}</Text>
        </View>

        {/* ── Tabela de itens ── */}
        <View style={v.table}>
          <View style={v.tableHeader}>
            <Text style={[v.th, { width: W.img }]}> </Text>
            <Text style={[v.th, { flex: 1 }]}>MATERIAL / OPERACIONAL</Text>
            <Text style={[v.th, { width: W.acab }]}>ACABAMENTO</Text>
            <Text style={[v.th, { width: W.kit }]}>KIT</Text>
            <Text style={[v.th, { width: W.qtd, textAlign: "right" }]}>QTD</Text>
            <Text style={[v.th, { width: W.und, textAlign: "right" }]}>UN.</Text>
            <Text style={[v.th, { width: W.vun, textAlign: "right" }]}>R$ UNIT.</Text>
            <Text style={[v.th, { width: W.vtot, textAlign: "right" }]}>R$ TOTAL</Text>
          </View>

          {orcamento.itens.map((item, idx) => {
            const src = toImgSrc(item.imagemReferencia);
            return (
              <View key={item.id} style={[v.row, idx % 2 !== 0 ? v.rowAlt : {}]} wrap={false}>
                <View style={v.imgBox}>
                  {src ? <Image src={src} style={v.imgEl} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[v.td, { fontFamily: "Helvetica-Bold", color: "#111827" }]}>{item.item}</Text>
                  {item.descricao ? (
                    <Text style={{ fontSize: 7, color: "#6b7280", marginTop: 2, lineHeight: 1.3 }}>{item.descricao}</Text>
                  ) : null}
                </View>
                <Text style={[v.td, { width: W.acab }]}>{item.acabamento}</Text>
                <Text style={[v.td, { width: W.kit }]}>{item.kit || "—"}</Text>
                <Text style={[v.td, { width: W.qtd, textAlign: "right" }]}>{item.quantidade}</Text>
                <Text style={[v.td, { width: W.und, textAlign: "right" }]}>UN</Text>
                <Text style={[v.td, { width: W.vun, textAlign: "right" }]}>{fmt(item.valorUnitario)}</Text>
                <Text style={[v.td, { width: W.vtot, fontFamily: "Helvetica-Bold", color: "#fb4d06", textAlign: "right" }]}>
                  {fmt(item.total)}
                </Text>
              </View>
            );
          })}

          {/* Logística */}
          {freteVal && (
            <View style={[v.row, v.rowFrete]} wrap={false}>
              <View style={v.imgBox} />
              <Text style={[v.td, { flex: 1, fontFamily: "Helvetica-Bold", color: "#1e40af" }]}>
                LOGÍSTICA DE ENTREGA
              </Text>
              <Text style={[v.td, { width: W.acab, color: "#6b7280" }]}>Frete</Text>
              <Text style={[v.td, { width: W.kit }]}>—</Text>
              <Text style={[v.td, { width: W.qtd, textAlign: "right" }]}>1</Text>
              <Text style={[v.td, { width: W.und, textAlign: "right" }]}>—</Text>
              <Text style={[v.td, { width: W.vun, textAlign: "right" }]}>—</Text>
              <Text style={[v.td, { width: W.vtot, fontFamily: "Helvetica-Bold", color: "#1e40af", textAlign: "right" }]}>
                {valorFrete > 0 ? fmt(valorFrete) : freteVal}
              </Text>
            </View>
          )}
        </View>

        {/* ── Custos internos ── */}
        {orcamento.manuseio && orcamento.custoManuseio ? (
          <>
            <View style={v.sectionBar}>
              <Text style={v.sectionBarText}>CUSTOS INTERNOS</Text>
            </View>
            <View style={v.table}>
              <View style={v.tableHeader}>
                <Text style={[v.th, { flex: 1 }]}>SERVIÇO / MATERIAL</Text>
                <Text style={[v.th, { width: 40, textAlign: "right" }]}>QTD</Text>
                <Text style={[v.th, { width: 45, textAlign: "right" }]}>FREQ.</Text>
                <Text style={[v.th, { width: 95, textAlign: "right" }]}>VALOR UNITÁRIO</Text>
                <Text style={[v.th, { width: 95, textAlign: "right" }]}>VALOR TOTAL</Text>
              </View>
              <View style={v.row} wrap={false}>
                <Text style={[v.td, { flex: 1 }]}>Manuseio específico do projeto</Text>
                <Text style={[v.td, { width: 40, textAlign: "right" }]}>1</Text>
                <Text style={[v.td, { width: 45, textAlign: "right" }]}>R$</Text>
                <Text style={[v.td, { width: 95, textAlign: "right" }]}>{fmt(orcamento.custoManuseio)}</Text>
                <Text style={[v.td, { width: 95, fontFamily: "Helvetica-Bold", color: "#fb4d06", textAlign: "right" }]}>
                  {fmt(orcamento.custoManuseio)}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {/* ── Total ── */}
        <View style={v.totalRow}>
          {(orcamento.manuseio && orcamento.custoManuseio) || valorFrete > 0 ? (
            <View style={v.totalMeta}>
              <Text style={v.totalMetaLine}>Produtos: {fmt(totalProdutos)}</Text>
              {orcamento.manuseio && orcamento.custoManuseio ? (
                <Text style={v.totalMetaLine}>Serviços: {fmt(totalServicos)}</Text>
              ) : null}
              {valorFrete > 0 ? (
                <Text style={v.totalMetaLine}>Frete: {fmt(valorFrete)}</Text>
              ) : null}
            </View>
          ) : null}
          <Text style={v.totalLabel}>TOTAL</Text>
          <Text style={v.totalValue}>{fmt(totalGeral)}</Text>
        </View>

        {/* ── Honorários e Impostos ── */}
        {orcamento.mostrarHonorarios && ((orcamento.percHonorarios ?? 0) > 0 || (orcamento.percImpostos ?? 0) > 0) ? (() => {
          const hon = (orcamento.percHonorarios ?? 0) > 0;
          const imp = (orcamento.percImpostos ?? 0) > 0;
          const valHon = totalGeral * (orcamento.percHonorarios ?? 0) / 100;
          const valImp = totalGeral * (orcamento.percImpostos ?? 0) / 100;
          return (
            <View style={v.honBox}>
              <View style={v.honHeader}>
                <Text style={v.honHeaderText}>COMPOSIÇÃO DO VALOR TOTAL</Text>
              </View>
              {hon && (
                <View style={imp ? v.honRow : v.honRowLast} wrap={false}>
                  <Text style={v.honLabel}>Honorários</Text>
                  <Text style={v.honValue}>{fmt(valHon)}</Text>
                </View>
              )}
              {imp && (
                <View style={v.honRowLast} wrap={false}>
                  <Text style={v.honLabel}>Impostos</Text>
                  <Text style={v.honValue}>{fmt(valImp)}</Text>
                </View>
              )}
            </View>
          );
        })() : null}

        {/* ── Observações ── */}
        {orcamento.observacoes ? (
          <View style={v.obsBar}>
            <Text style={v.obsBarText}>OBS.: {orcamento.observacoes}</Text>
          </View>
        ) : null}

      </Page>
    </Document>
  );
}

// ─── PDF 3 — Ordem de Serviço (interno, COM referência) ──────────────────────
export function PdfOrdemServico({ orcamento, logoBase64 }: { orcamento: Orcamento; logoBase64?: string }) {
  const tiposNota = (orcamento.tiposNota || []).join(" + ") || "—";
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={os.page}>

        {/* Cabeçalho */}
        <View style={os.header}>
          <View>
            {logoBase64 ? (
              <Image src={toImgSrc(logoBase64)} style={{ maxWidth: 100, maxHeight: 28 }} />
            ) : (
              <>
                <Text style={os.logoText}>alt.</Text>
                <Text style={os.logoSub}>marketing</Text>
              </>
            )}
          </View>
          <View style={os.headerRight}>
            <Text style={os.osTitle}>ORDEM DE SERVIÇO</Text>
            <Text style={os.osNumero}>OS Nº {orcamento.numero}{orcamento.nomeProjeto ? ` · ${orcamento.nomeProjeto}` : ""}</Text>
          </View>
        </View>

        {/* Informações do pedido */}
        <View style={os.badge}>
          <Text style={os.badgeTitle}>Dados do Pedido</Text>
          <View style={os.grid}>
            <View style={os.cell}>
              <Text style={os.cellLabel}>CLIENTE</Text>
              <Text style={os.cellValue}>{orcamento.cliente || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>SOLICITANTE</Text>
              <Text style={os.cellValue}>{orcamento.solicitante || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>RESPONSÁVEL</Text>
              <Text style={os.cellValue}>{orcamento.responsavel || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>DATA DA SOLICITAÇÃO</Text>
              <Text style={os.cellValue}>{orcamento.dataSolicitacao || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>DATA DA ELABORAÇÃO</Text>
              <Text style={os.cellValue}>{orcamento.dataOrcamento || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>PRAZO DE ENTREGA</Text>
              <Text style={os.cellValue}>{orcamento.prazoEntrega || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>PRAZO DE PAGAMENTO</Text>
              <Text style={os.cellValue}>{orcamento.prazoPagamento || "—"}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>TIPO DE NOTA</Text>
              <Text style={os.cellValue}>{tiposNota}</Text>
            </View>
            <View style={os.cell}>
              <Text style={os.cellLabel}>STATUS</Text>
              <Text style={os.cellValue}>{orcamento.status || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Tags de tipo de nota */}
        {(orcamento.tiposNota || []).length > 0 && (
          <View style={os.notaBox}>
            {(orcamento.tiposNota || []).map((t) => (
              <View key={t} style={os.notaTag}>
                <Text style={os.notaTagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Observações */}
        {orcamento.observacoes ? (
          <View style={os.obsBox}>
            <Text style={os.obsText}>OBS.: {orcamento.observacoes}</Text>
          </View>
        ) : null}

        {/* Tabela de itens — COM referência (uso interno) */}
        <View style={os.table}>
          <View style={os.tableHeader}>
            <Text style={os.thKit}>KIT</Text>
            <Text style={os.thRef}>REFERÊNCIA</Text>
            <Text style={os.thItem}>ITEM</Text>
            <Text style={os.thAcab}>ACABAMENTO</Text>
            <Text style={os.thDesc}>DESCRIÇÃO TÉCNICA</Text>
            <Text style={os.thQtd}>QTD.</Text>
          </View>
          {orcamento.itens.map((item, idx) => (
            <View key={item.id} style={[os.row, idx % 2 !== 0 ? os.rowAlt : {}]} wrap={false}>
              <Text style={os.tdKit}>{item.kit}</Text>
              <Text style={os.tdRef}>{item.referencia}</Text>
              <Text style={os.tdItem}>{item.item}</Text>
              <Text style={os.tdAcab}>{item.acabamento}</Text>
              <Text style={os.tdDesc}>{item.descricao}</Text>
              <Text style={os.tdQtd}>{item.quantidade}</Text>
            </View>
          ))}
        </View>

        {/* Rodapé */}
        <View style={os.footer} fixed>
          <Text style={os.footerText}>OS {orcamento.numero} · Uso interno alt. marketing</Text>
          <Text style={os.footerText}>Gerado em {new Date().toLocaleDateString("pt-BR")}</Text>
        </View>
      </Page>
    </Document>
  );
}
