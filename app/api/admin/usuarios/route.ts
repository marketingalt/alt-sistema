import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAllUsers, setAdminRole, setUserPermissions, checkIsAdmin } from "@/lib/admin";

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
    const { targetUserId, role, permissoes } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId é obrigatório" },
        { status: 400 }
      );
    }

    // ── Atualizar role ──
    if (role) {
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
    }

    // ── Atualizar permissões ──
    if (permissoes) {
      const VALIDAS = ["orcamentos", "clientes", "fornecedores", "produtos", "financeiro"];
      const invalidas = permissoes.filter((p: string) => !VALIDAS.includes(p));
      if (invalidas.length > 0) {
        return NextResponse.json(
          { error: `Permissões inválidas: ${invalidas.join(", ")}` },
          { status: 400 }
        );
      }

      await setUserPermissions(targetUserId, permissoes);
      return NextResponse.json({ ok: true, permissoes });
    }

    return NextResponse.json(
      { error: "Envie 'role' ou 'permissoes' para atualizar" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Erro ao alterar usuário:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
