"use client";

import WorkspaceLayout from "@/app/components/WorkspaceLayout";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
