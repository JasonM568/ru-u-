import { requireEnrollment } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enrollment, email } = await requireEnrollment();

  return (
    <div className="min-h-screen">
      <AppNav enrollment={enrollment} email={email} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
