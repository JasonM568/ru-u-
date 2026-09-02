"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ThesisCard } from "@/lib/flow/state";
import { thesisText } from "@/lib/flow/thesis";
import { deleteThesisCard } from "../actions";

/**
 * 一張雲端論點卡的操作列：載入到控制台／複製／刪除。
 * 「載入到控制台」直接改寫 localStorage 裡的 state.tc（控制台是純客戶端，
 * 沒有別的入口），然後導到 /flow。其他層的交棒卡不動。
 */
export function CardActions({ userId, card }: { userId: string; card: ThesisCard }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  const loadToConsole = () => {
    const key = `flow5:${userId}`;
    try {
      const raw = window.localStorage.getItem(key);
      const state = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      state.tc = card;
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      setMsg("這個瀏覽器無法寫入本機儲存，載入失敗");
      return;
    }
    router.push("/flow");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-gold rounded-lg px-4 py-2 text-sm" onClick={loadToConsole}>
        載入到控制台
      </button>
      <button
        type="button"
        className="btn-ghost rounded-lg px-4 py-2 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(thesisText(card));
            setMsg("已複製整張卡");
          } catch {
            setMsg("複製失敗，請展開後手動選取");
          }
        }}
      >
        複製整張卡
      </button>
      <form
        action={deleteThesisCard}
        onSubmit={(e) => {
          if (!window.confirm("刪除這張雲端論點卡？刪了就找不回來。")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={card.id ?? ""} />
        <button type="submit" className="rounded-lg px-3 py-2 text-sm text-rose-500 hover:underline">
          刪除
        </button>
      </form>
      {msg && <span className="text-sm text-slate-400">{msg}</span>}
    </div>
  );
}
