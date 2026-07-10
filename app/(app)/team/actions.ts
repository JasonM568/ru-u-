"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEnrollment } from "@/lib/auth";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
}
function num(fd: FormData, k: string): number | null {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function teamContext() {
  const ctx = await requireEnrollment();
  // 講師可用後台工具；此處僅供學員在自己隊伍填寫
  if (ctx.enrollment.class_role !== "student" || !ctx.enrollment.team_id) {
    redirect("/team?error=noteam");
  }
  return ctx as typeof ctx & { enrollment: { team_id: number } };
}

// ── 表一 每週例會 ──
export async function createMeeting(formData: FormData) {
  const { supabase, userId, enrollment } = await teamContext();
  const { error } = await supabase
    .schema("elite")
    .from("team_meetings")
    .insert({
      team_id: enrollment.team_id,
      meet_date: str(formData, "meet_date") ?? new Date().toISOString().slice(0, 10),
      host: str(formData, "host"),
      attendees: str(formData, "attendees"),
      env_tone: str(formData, "env_tone"),
      candidate: str(formData, "candidate"),
      market_read: str(formData, "market_read"),
      timing: str(formData, "timing"),
      allocation: str(formData, "allocation"),
      execution: str(formData, "execution"),
      risk_check: {
        stop_loss: formData.get("rc_stop_loss") === "on",
        within_limit: formData.get("rc_within_limit") === "on",
        five_rules: formData.get("rc_five_rules") === "on",
      },
      risk_officer_note: str(formData, "risk_officer_note"),
      decision: str(formData, "decision"),
      decision_reason: str(formData, "decision_reason"),
      invalidation: str(formData, "invalidation"),
      watch_next: str(formData, "watch_next"),
      created_by: userId,
    });
  if (error) redirect(`/team/meetings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/team/meetings");
  redirect("/team/meetings?saved=1");
}

// ── 表二 決策台帳 ──
export async function createTrade(formData: FormData) {
  const { supabase, userId, enrollment } = await teamContext();
  const { error } = await supabase
    .schema("elite")
    .from("trade_ledger")
    .insert({
      team_id: enrollment.team_id,
      trade_date: str(formData, "trade_date") ?? new Date().toISOString().slice(0, 10),
      symbol: str(formData, "symbol"),
      direction: str(formData, "direction"),
      entry: num(formData, "entry"),
      stop_loss: num(formData, "stop_loss"),
      take_profit: num(formData, "take_profit"),
      position_pct: num(formData, "position_pct"),
      rationale: str(formData, "rationale"),
      invalidation: str(formData, "invalidation"),
      result: str(formData, "result"),
      attribution: str(formData, "attribution"),
      created_by: userId,
    });
  if (error) redirect(`/team/ledger?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/team/ledger");
  redirect("/team/ledger?saved=1");
}

// ── 表三 覆盤 ──
export async function createReview(formData: FormData) {
  const { supabase, userId, enrollment } = await teamContext();
  const predictions = {
    env: { pred: str(formData, "env_pred"), actual: str(formData, "env_actual"), hit: formData.get("env_hit") === "on" },
    market: { pred: str(formData, "market_pred"), actual: str(formData, "market_actual"), hit: formData.get("market_hit") === "on" },
    symbol: { pred: str(formData, "symbol_pred"), actual: str(formData, "symbol_actual"), hit: formData.get("symbol_hit") === "on" },
    execution: { pred: str(formData, "exec_pred"), actual: str(formData, "exec_actual"), hit: formData.get("exec_hit") === "on" },
  };
  const { error } = await supabase
    .schema("elite")
    .from("reviews")
    .insert({
      team_id: enrollment.team_id,
      review_date: str(formData, "review_date") ?? new Date().toISOString().slice(0, 10),
      predictions,
      pnl: str(formData, "pnl"),
      attribution: str(formData, "attribution"),
      lesson: str(formData, "lesson"),
      root_cause: str(formData, "root_cause"),
      guardrail: str(formData, "guardrail"),
      repeated: formData.get("repeated") === "on",
      repeated_note: str(formData, "repeated_note"),
      created_by: userId,
    });
  if (error) redirect(`/team/reviews?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/team/reviews");
  redirect("/team/reviews?saved=1");
}
