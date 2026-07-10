import { requireInstructor } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 二次把關：非講師者會被導回儀表板
  await requireInstructor();
  return <>{children}</>;
}
