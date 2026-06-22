import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkIsAdmin } from "@/lib/admin";
import { getDocumentos, adicionarDocumento } from "@/lib/documentos-rh";
import { readFile } from "@/lib/storage-file-adapter";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress || "";
    const isAdmin = await checkIsAdmin(userId);

    const searchParams = req.nextUrl.searchParams;
    const targetEmail = searchParams.get("email");
    const downloadId = searchParams.get("download");

    // Download de arquivo
    if (downloadId && targetEmail) {
      // Admins podem baixar de qualquer um; usuários só os próprios
      if (!isAdmin && targetEmail !== email) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
      const docs = await getDocumentos(targetEmail);
      const doc = docs.find((d) => d.id === downloadId);
      if (!doc) {
        return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }

      const safe = targetEmail.replace(/[^a-zA-Z0-9]/g, "_");
      try {
        const buffer = await readFile("rh", safe, doc.caminho);
        return new Response(new Blob([buffer], { type: doc.tipo || "application/octet-stream" }), {
          headers: {
            "Content-Disposition": `attachment; filename="${doc?.nome || downloadId}"`,
          },
        });
      } catch {
        return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }
    }

    // Listar documentos
    // Admins podem ver de qualquer email; usuários só os próprios
    const listaEmail = isAdmin && targetEmail ? targetEmail : email;
    const docs = await getDocumentos(listaEmail);

    return NextResponse.json({ email: listaEmail, documentos: docs });
  } catch (err) {
    console.error("Erro ao listar documentos RH:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const user = await currentUser();
    const uploadedBy = user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress || "Admin";

    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File;
    const email = formData.get("email") as string;
    const categoria = (formData.get("categoria") as string) || "outro";

    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email do usuário é obrigatório" }, { status: 400 });
    }

    const doc = await adicionarDocumento(email, arquivo, categoria, uploadedBy);
    return NextResponse.json(doc);
  } catch (err) {
    console.error("Erro ao fazer upload de documento RH:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
