"use server";

import { redirect } from "next/navigation";
import { requireEnrollment } from "@/lib/auth";
import { cardIsEmpty, cardToRow, sanitizeCard } from "@/lib/flow/cloud";
import { reconcileFromStrings } from "@/lib/flow/reconcile";

export type SaveThesisCardResult =
  | { ok: true; id: string; updatedAt: string }
  | { ok: false; error: string };

/**
 * 把控制台裡的論點卡存到 elite.thesis_cards。
 *
 * 與問卷不同的地方：控制台是純客戶端工具，存完要把資料庫給的 id 寫回 localStorage，
 * 所以這裡不用 redirect，而是直接回傳結果給呼叫端。
 * 前端只負責把 state.tc 序列化成 JSON；server 端 sanitizeCard 收斂欄位、
 * cardToRow 用 lib/flow/ccc.ts 重算 cc_* 五欄，前端算的數字一律不採用。
 */
export async function saveThesisCard(payload: {
  card: string;
  groupId?: string;
  asOf?: string;
}): Promise<SaveThesisCardResult> {
  const { supabase, userId } = await requireEnrollment();

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.card);
  } catch {
    return { ok: false, error: "論點卡資料無法解析" };
  }
  const tc = sanitizeCard(parsed);
  if (cardIsEmpty(tc)) {
    return { ok: false, error: "至少填標的代號、名稱或核心論點，再存雲端" };
  }

  const row = cardToRow(tc, {
    userId,
    groupId: payload.groupId?.slice(0, 50) ?? null,
    asOf: payload.asOf?.slice(0, 50) ?? null,
  });
  const now = new Date().toISOString();

  if (tc.id) {
    // 更新：RLS 只允許本人的列；別人的 id 會更新到 0 列，回報找不到
    const { data, error } = await supabase
      .schema("elite")
      .from("thesis_cards")
      .update({ ...row, updated_at: now })
      .eq("id", tc.id)
      .eq("user_id", userId)
      .select("id, updated_at")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (data) return { ok: true, id: data.id, updatedAt: data.updated_at };
    // id 對不上（例如換了帳號或卡已被刪）→ 當新卡存
  }

  const { data, error } = await supabase
    .schema("elite")
    .from("thesis_cards")
    .insert({ ...row, updated_at: now })
    .select("id, updated_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, updatedAt: data.updated_at };
}

/** 從「我的論點卡」頁刪除一張自己的卡。RLS 限本人，講師刪不到學員的卡。 */
export async function deleteThesisCard(formData: FormData) {
  const { supabase, userId } = await requireEnrollment();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/flow/cards?error=missing");

  const { error } = await supabase
    .schema("elite")
    .from("thesis_cards")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) redirect(`/flow/cards?error=${encodeURIComponent(error.message)}`);
  redirect("/flow/cards?deleted=1");
}

const tri = (v: FormDataEntryValue | null): boolean | null =>
  v === "yes" ? true : v === "no" ? false : null;

/**
 * T+20 對帳：學員在月例會時對自己的論點卡填三個證偽條件的觸發情況。
 * 四象限 outcome、pnl、any_triggered 一律在 server 端用 lib/flow/reconcile.ts 重算。
 * 一張卡一筆（upsert on card_id）。RLS 保證只能對自己的卡填。
 */
export async function saveReconciliation(formData: FormData) {
  const { supabase, userId } = await requireEnrollment();
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) redirect("/flow/cards?error=missing");

  // 卡必須是自己的（RLS 也會擋，這裡先給清楚的錯誤）
  const { data: card } = await supabase
    .schema("elite")
    .from("thesis_cards")
    .select("id")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!card) redirect("/flow/cards?error=missing");

  const checks = [1, 2, 3].map((i) => ({
    triggered: tri(formData.get(`t${i}`)),
    note: String(formData.get(`n${i}`) ?? "").slice(0, 2000),
  }));
  const executed = tri(formData.get("executed"));
  const entryPx = String(formData.get("entry_px") ?? "").trim().slice(0, 50);
  const checkPx = String(formData.get("check_px") ?? "").trim().slice(0, 50);
  const r = reconcileFromStrings({ checks, executed, entryPx, checkPx });
  const now = new Date().toISOString();

  const { error } = await supabase
    .schema("elite")
    .from("thesis_reconciliations")
    .upsert(
      {
        card_id: cardId,
        user_id: userId,
        checked_on: String(formData.get("checked_on") ?? "").trim().slice(0, 50),
        entry_px: entryPx,
        check_px: checkPx,
        checks,
        executed,
        reflection: String(formData.get("reflection") ?? "").slice(0, 4000),
        pnl_pct: r.pnl,
        any_triggered: r.anyTriggered,
        outcome: r.outcome,
        updated_at: now,
      },
      { onConflict: "card_id" },
    );

  if (error) redirect(`/flow/cards?error=${encodeURIComponent(error.message)}`);
  redirect(`/flow/cards?recon=${cardId}#card-${cardId}`);
}
