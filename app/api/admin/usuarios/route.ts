import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAllUsers, setAdminRole, checkIsAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const usuarios = await getAllUsers();
    return NextResponse.json(usuarios);
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
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

    const body = await req.json();
    const { targetUserId, role } = body;

    if (!targetUserId || !role) {
      return NextResponse.json(
        { error: "targetUserId e role são obrigatórios" },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "user") {
      return NextResponse.json(
        { error: "role deve ser 'admin' ou 'user'" },
        { status: 400 }
      );
    }

    // Não permitir que um admin se rebaixe (evita zero admins)
    if (targetUserId === userId && role === "user") {
      const admins = (await getAllUsers()).filter((u) => u.role === "admin");
      if (admins.length <= 1) {
        return NextResponse.json(
          { error: "Você é o único administrador. Promova outro antes de se rebaixar." },
          { status: 400 }
        );
      }
    }

    await setAdminRole(targetUserId, role);
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    console.error("Erro ao alterar role:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
