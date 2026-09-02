"use server";

import { redirect } from "next/navigation";
import { requireEnrollment, requireInstructor } from "@/lib/auth";
import { cardIsEmpty, cardToRow, sanitizeCard } from "@/lib/flow/cloud";
import { reconcileFromStrings } from "@/lib/flow/reconcile";
import { sanitizeSplitConfig } from "@/lib/flow/config";
import { MAX_RUNS, sanitizeState, type RunSummary } from "@/lib/flow/runs";
import type { FlowState } from "@/lib/flow/state";

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
  runId?: string | null;
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

  const row = {
    ...cardToRow(tc, {
      userId,
      groupId: payload.groupId?.slice(0, 50) ?? null,
      asOf: payload.asOf?.slice(0, 50) ?? null,
    }),
    // 回連作業存檔；不是合法 uuid 就不連（RLS 會擋別人的存檔，這裡先不讓壞值進資料庫）
    run_id: payload.runId && /^[0-9a-f-]{36}$/i.test(payload.runId) ? payload.runId : null,
  };
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

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * 講師把目前控制台的分段設定下發給全班（一個比較群組一份，重下發＝覆蓋）。
 * payload 先經 lib/flow/config.ts 驗證：未知群組、壞掉的 assign 都進不了資料庫。
 */
export async function publishFlowConfig(payload: {
  title: string;
  note: string;
  config: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireInstructor();

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.config);
  } catch {
    return { ok: false, error: "分段設定無法解析" };
  }
  const cfg = sanitizeSplitConfig(parsed);
  if (!cfg) return { ok: false, error: "分段設定格式不符或群組不存在" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("elite")
    .from("flow_configs")
    .upsert(
      {
        group_id: cfg.group,
        title: payload.title.trim().slice(0, 100),
        note: payload.note.trim().slice(0, 2000),
        payload: cfg,
        published_by: userId,
        updated_at: now,
      },
      { onConflict: "group_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unpublishFlowConfig(groupId: string): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").from("flow_configs").delete().eq("group_id", groupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── 作業存檔（階段五） ──

export type SaveRunResult = { ok: true; id: string; updatedAt: string } | { ok: false; error: string };

/** 讀一個存檔的完整狀態（RLS：本人或講師）。 */
export async function loadRun(id: string): Promise<{ ok: true; state: FlowState; title: string; updatedAt: string } | { ok: false; error: string }> {
  const { supabase } = await requireEnrollment();
  const { data, error } = await supabase
    .schema("elite")
    .from("flow_runs")
    .select("state, title, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "找不到這個存檔" };
  return { ok: true, state: sanitizeState(data.state), title: data.title, updatedAt: data.updated_at };
}

/**
 * 存整份控制台狀態。有 id 就更新（RLS 限本人），沒有就新建（每人 MAX_RUNS 檔，server 先數、trigger 保底）。
 * state 一律經 sanitizeState：每張交棒卡截到 MAX_CARD_CHARS、非法欄位丟掉。
 */
export async function saveRun(payload: { id?: string | null; title: string; state: string }): Promise<SaveRunResult> {
  const { supabase, userId } = await requireEnrollment();
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.state);
  } catch {
    return { ok: false, error: "存檔資料無法解析" };
  }
  const state = sanitizeState(parsed);
  const title = payload.title.trim().slice(0, 80);
  const now = new Date().toISOString();

  if (payload.id) {
    const { data, error } = await supabase
      .schema("elite")
      .from("flow_runs")
      .update({ title, state, updated_at: now })
      .eq("id", payload.id)
      .eq("user_id", userId)
      .select("id, updated_at")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (data) return { ok: true, id: data.id, updatedAt: data.updated_at };
    return { ok: false, error: "找不到這個存檔（可能已被刪除）" };
  }

  const { count } = await supabase
    .schema("elite")
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) >= MAX_RUNS) {
    return { ok: false, error: `作業存檔已達上限 ${MAX_RUNS} 檔，請先刪除舊的存檔` };
  }

  const { data, error } = await supabase
    .schema("elite")
    .from("flow_runs")
    .insert({ user_id: userId, title, state, updated_at: now })
    .select("id, updated_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, updatedAt: data.updated_at };
}

export async function deleteRun(id: string): Promise<ActionResult> {
  const { supabase, userId } = await requireEnrollment();
  const { error } = await supabase.schema("elite").from("flow_runs").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 存檔列表（不含 state）。 */
export async function listRuns(): Promise<RunSummary[]> {
  const { supabase, userId } = await requireEnrollment();
  const { data } = await supabase
    .schema("elite")
    .from("flow_runs")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as RunSummary[];
}
