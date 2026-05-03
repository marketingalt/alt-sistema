import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TIPOS_PERSONALIZACAO = ["Silk", "DTF", "Bordado", "Laser", "Verniz UV", "Tampografia", "Sublimação", "Gravação em relevo"];

const SYSTEM_PROMPT = `Você é um assistente especializado em orçamentos de brindes e produtos personalizados para a agência Alt Marketing.
Seu trabalho é extrair informações de pedidos de clientes (textos, e-mails, documentos, imagens) e estruturá-las em um formato padronizado JSON.

Tipos de personalização disponíveis: ${TIPOS_PERSONALIZACAO.join(", ")}.

Retorne APENAS um JSON válido, sem explicações, sem markdown, sem blocos de código. Exatamente neste formato:
{
  "cliente": "nome do cliente",
  "solicitante": "nome do solicitante se mencionado",
  "prazoPagamento": "prazo de pagamento se mencionado",
  "prazoEntrega": "prazo de entrega se mencionado",
  "observacoes": "observações gerais",
  "frete": "CUSTO ADICIONAL - ORÇADO APÓS O ENVIO DA PLANILHA DE ENDEREÇOS DE ENTREGA PARA TODO O BRASIL",
  "itens": [
    {
      "kit": "nome do kit se agrupado, senão vazio",
      "referencia": "código de referência do produto se mencionado",
      "item": "nome do produto",
      "acabamento": "tipo de personalização",
      "descricao": "descrição técnica completa do produto com especificações e dimensões se disponíveis",
      "quantidade": 0,
      "valorUnitario": 0,
      "total": 0
    }
  ]
}

Se não encontrar alguma informação, deixe o campo como string vazia ou 0 para números.
Campos de valor deixe como 0 se não mencionados — o usuário preencherá manualmente.`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const texto = formData.get("texto") as string | null;
    const arquivo = formData.get("arquivo") as File | null;

    // Coleta todas as imagens coladas (imagem_0, imagem_1, etc.)
    const imagensColadas: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("imagem_") && value instanceof File) {
        imagensColadas.push(value);
      }
    }

    // Monta os blocos de conteúdo para o Claude
    const blocos: MessageParam["content"] = [];

    // Texto principal
    if (texto?.trim()) {
      blocos.push({ type: "text", text: `Pedido recebido:\n\n${texto}` });
    }

    // Arquivo de imagem único
    if (arquivo && arquivo.type.startsWith("image/")) {
      const bytes = await arquivo.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      blocos.push({
        type: "image",
        source: {
          type: "base64",
          media_type: arquivo.type as ImageMediaType,
          data: base64,
        },
      });
    }

    // Imagens coladas junto com o texto
    for (const img of imagensColadas) {
      const bytes = await img.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const mediaType = img.type || "image/png";
      blocos.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as ImageMediaType,
          data: base64,
        },
      });
    }

    if (blocos.length === 0) {
      return NextResponse.json({ error: "Nenhum conteúdo fornecido." }, { status: 400 });
    }

    blocos.push({
      type: "text",
      text: "Com base em todo o conteúdo acima (texto e imagens), extraia as informações do pedido e retorne o JSON padronizado.",
    });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: blocos }],
    });

    const resposta = message.content[0].type === "text" ? message.content[0].text : "{}";
    const json = JSON.parse(resposta.trim());
    return NextResponse.json(json);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao processar pedido." }, { status: 500 });
  }
}
