"use client";

import dynamic from "next/dynamic";
import type { PublishedConfig } from "@/lib/flow/config";

/**
 * 控制台是純客戶端工具，狀態存在瀏覽器 localStorage。
 * 關掉 SSR 之後，狀態可以在 useState 初始化時直接讀出來，
 * 不必在 effect 裡 setState（會造成串連渲染），也不會有 hydration 不一致。
 * ssr: false 只能寫在 Client Component 裡，所以需要這一層。
 */
const FlowConsole = dynamic(() => import("./FlowConsole").then((m) => m.FlowConsole), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-slate-400">載入控制台…</p>,
});

export function FlowConsoleLoader({
  userId,
  isInstructor,
  configs,
}: {
  userId: string;
  isInstructor: boolean;
  configs: PublishedConfig[];
}) {
  return <FlowConsole userId={userId} isInstructor={isInstructor} configs={configs} />;
}
