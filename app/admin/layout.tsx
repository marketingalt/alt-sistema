import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkIsAdmin, autoSeedAdmin } from "@/lib/admin";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const isAdmin = await checkIsAdmin(userId);

  if (!isAdmin) {
    // Tenta auto-seed: se não houver nenhum admin, promove este usuário
    const seeded = await autoSeedAdmin(userId);
    if (!seeded) {
      redirect("/acesso-negado");
    }
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
