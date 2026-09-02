import { requireEnrollment } from "@/lib/auth";
import { FlowConsoleLoader } from "./FlowConsoleLoader";

export const metadata = {
  title: "五層作業流控制台 — 菁英班孵化系統",
};

export default async function FlowPage() {
  const { userId } = await requireEnrollment();
  return <FlowConsoleLoader userId={userId} />;
}
