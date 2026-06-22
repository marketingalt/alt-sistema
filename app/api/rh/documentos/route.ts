import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkIsAdmin } from "@/lib/admin";
import { getDocumentos, adicionarDocumento, downloadPath } from "@/lib/documentos-rh";

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
      const filePath = downloadPath(targetEmail, downloadId);
      if (!filePath) {
        return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }
      const fs = await import("fs");
      const buffer = fs.readFileSync(filePath);
      const docs = getDocumentos(targetEmail);
      const doc = docs.find((d) => d.id === downloadId);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": doc?.tipo || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${doc?.nome || downloadId}"`,
        },
      });
    }

    // Listar documentos
    // Admins podem ver de qualquer email; usuários só os próprios
    const listaEmail = isAdmin && targetEmail ? targetEmail : email;
    const docs = getDocumentos(listaEmail);

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
