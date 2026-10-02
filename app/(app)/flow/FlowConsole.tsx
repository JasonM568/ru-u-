"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, PageHeader, Field, Input, Select } from "@/components/ui";
import {
  CRS_MATRIX,
  GROUPS,
  MIGRATION_SIGNALS,
  RENT_PHASES,
} from "@/lib/flow/segments";
import { CARD_LABEL, type CardId, type PromptContext } from "@/lib/flow/prompts";
import {
  COMMON_MISTAKES,
  IRON_RULES,
  STATIONS,
  TAKEAWAYS,
  type Station,
} from "@/lib/flow/stations";
import {
  activeSubs,
  blankState,
  layout,
  resolveGroup,
  locateTicker,
  rosterText,
  seedStock,
  stockCount,
  subNames,
  type FlowState,
} from "@/lib/flow/state";
import { RosterEditor, ThresholdTable } from "./RosterEditor";
import { ChainEditor } from "./ChainEditor";
import type { PublishedConfig } from "@/lib/flow/config";
import { forkForNextTarget, isBlankState, runTitle, type RunSummary } from "@/lib/flow/runs";
import { deleteRun, loadRun, saveRun } from "./actions";
import { RunBar, type SaveStatus } from "./RunBar";
import { ThesisCardForm, cccOf, thesisText } from "./ThesisCardForm";

type StationStatus = { kind: "wait" | "open" | "blocked" | "done"; label: string };

/** 這個元件只在客戶端載入（見 FlowConsoleLoader），所以初始化時就能安全地讀 localStorage。 */
function loadState(key: string): FlowState {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return { ...blankState(), ...(JSON.parse(raw) as Partial<FlowState>) };
  } catch {
    // 壞掉的舊資料就當作沒有，不要讓整頁掛掉
  }
  return blankState();
}

export function FlowConsole({
  userId,
  isInstructor,
  configs,
  initialRuns,
}: {
  userId: string;
  isInstructor: boolean;
  configs: PublishedConfig[];
  initialRuns: RunSummary[];
}) {
  const storageKey = `flow5:${userId}`;
  const runKey = `${storageKey}:run`;
  const [state, setState] = useState<FlowState>(() => loadState(storageKey));
  const [toast, setToast] = useState("");

  // ── 作業存檔（階段五）──
  // localStorage 仍是本機快取；雲端 elite.flow_runs 才是正本。改動後 2.5 秒自動存。
  const [runs, setRuns] = useState<RunSummary[]>(initialRuns);
  const [runId, setRunId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(runKey);
    } catch {
      return null;
    }
  });
  const [runName, setRunName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  const runIdRef = useRef(runId);
  const nameRef = useRef(runName);
  const skipNextSaveRef = useRef(true); // 初次 render 與「從雲端載入」不算變更
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const doSaveRef = useRef<() => Promise<void>>(async () => {});
  // 世代計數：切換／新建／換標的／刪除時 +1；較舊世代的存檔回來時不准改目前的 id、標題、狀態列
  const genRef = useRef(0);
  // 有未存變更（用 ref 而非 state，避免 flush 讀到舊的 closure）
  const dirtyRef = useRef(false);
  // ref 同步放在 effect（不在 render 期間改 ref）；宣告在其他 effect 之前，確保先同步
  useEffect(() => {
    stateRef.current = state;
    runIdRef.current = runId;
    nameRef.current = runName;
  });

  const persistRunId = useCallback(
    (id: string | null) => {
      setRunId(id);
      try {
        if (id) window.localStorage.setItem(runKey, id);
        else window.localStorage.removeItem(runKey);
      } catch {
        // 快取寫不進去不影響雲端
      }
    },
    [runKey],
  );

  const doSave = useCallback(async () => {
    const s = stateRef.current;
    const id = runIdRef.current;
    if (!id && isBlankState(s)) {
      setSaveStatus("idle");
      return;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    dirtyRef.current = false;
    const gen = genRef.current;
    setSaveStatus("saving");
    const title = nameRef.current || runTitle(s);
    const res = await saveRun({ id, title, state: JSON.stringify(s) });
    savingRef.current = false;
    if (res.ok) {
      setRuns((prev) => [{ id: res.id, title, updated_at: res.updatedAt }, ...prev.filter((r) => r.id !== res.id)]);
    }
    if (gen !== genRef.current) {
      // 使用者已經切到別的作業：這次存檔只更新列表，不碰目前作業的 id／標題／狀態
      if (pendingRef.current) {
        pendingRef.current = false;
        void doSaveRef.current();
      }
      return;
    }
    if (!res.ok) {
      setSaveStatus("error");
      setSaveError(res.error);
      return;
    }
    if (!id) persistRunId(res.id);
    setRunName(title);
    setSavedAt(res.updatedAt);
    setSaveStatus("saved");
    if (pendingRef.current) {
      pendingRef.current = false;
      void doSaveRef.current();
    }
  }, [persistRunId]);
  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current || pendingRef.current) await doSave();
    // 有存檔還在路上就等它回來，免得它帶著舊 id 把新作業的狀態寫錯地方
    for (let i = 0; i < 100 && savingRef.current; i++) await new Promise((r) => window.setTimeout(r, 50));
  }, [doSave]);

  // 自動存檔：state 一變就排程，2.5 秒內沒再變才真的送
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setSaveStatus("dirty");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void doSave(), 2500);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state, doSave]);

  const applyLoaded = useCallback((next: FlowState, id: string, title: string, at: string) => {
    skipNextSaveRef.current = true;
    setState(next);
    setRunName(title);
    setSavedAt(at);
    setSaveStatus("saved");
    setSaveError("");
    persistRunId(id);
  }, [persistRunId]);

  // 進頁：有目前存檔就從雲端載入（別台裝置可能改過）；沒有就開最近一檔；都沒有但本機有舊資料就轉成第一個存檔
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = runId;
      const local = state;
      const known = id && initialRuns.some((r) => r.id === id) ? id : initialRuns[0]?.id ?? null;
      if (known && (id === known || isBlankState(local))) {
        const res = await loadRun(known);
        if (cancelled) return;
        if (res.ok) {
          applyLoaded(res.state, known, res.title, res.updatedAt);
          return;
        }
      }
      if (!isBlankState(local)) {
        persistRunId(null);
        await doSave();
        if (!cancelled) setToast("已把這台裝置的作業轉成雲端存檔");
      } else {
        persistRunId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 只在進頁跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchRun = useCallback(
    async (id: string) => {
      if (id === runIdRef.current) return;
      setBusy(true);
      await flush();
      genRef.current += 1;
      const res = await loadRun(id);
      if (res.ok) applyLoaded(res.state, id, res.title, res.updatedAt);
      else setToast(`載入失敗：${res.error}`);
      setBusy(false);
    },
    [applyLoaded, flush],
  );

  const newRun = useCallback(async () => {
    setBusy(true);
    await flush();
    genRef.current += 1;
    nameRef.current = "";
    dirtyRef.current = false;
    skipNextSaveRef.current = true;
    setState(blankState());
    setRunName("");
    setSavedAt(null);
    setSaveStatus("idle");
    persistRunId(null);
    setBusy(false);
    setToast("已開新作業，開始填寫後會自動建立存檔");
  }, [flush, persistRunId]);

  const forkRun = useCallback(async () => {
    setBusy(true);
    await flush();
    genRef.current += 1;
    nameRef.current = "";
    const next = forkForNextTarget(stateRef.current);
    persistRunId(null);
    setRunName("");
    setSavedAt(null);
    setState(next); // 不跳過：這算變更，2.5 秒後會自動建成新存檔
    setBusy(false);
    setToast("已保留 L0～交集，清掉 L3 之後；輸入新代號即可接著跑");
  }, [flush, persistRunId]);

  const renameRun = useCallback(
    (title: string) => {
      setRunName(title);
      nameRef.current = title;
      void doSave();
    },
    [doSave],
  );

  const removeRun = useCallback(async () => {
    const id = runIdRef.current;
    if (!id) return;
    if (!window.confirm(`刪除存檔「${runName || runTitle(stateRef.current)}」？刪了就找不回來（已存雲端的論點卡不受影響）。`)) return;
    setBusy(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const res = await deleteRun(id);
    if (!res.ok) {
      setToast(`刪除失敗：${res.error}`);
      setBusy(false);
      return;
    }
    setRuns((prev) => prev.filter((r) => r.id !== id));
    genRef.current += 1;
    nameRef.current = "";
    skipNextSaveRef.current = true;
    setState(blankState());
    setRunName("");
    setSavedAt(null);
    setSaveStatus("idle");
    persistRunId(null);
    setBusy(false);
    setToast("已刪除存檔");
  }, [persistRunId, runName]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // 隱私模式或容量滿：靜默略過，畫面照常可用
    }
  }, [state, storageKey]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const update = useCallback((fn: (draft: FlowState) => void) => {
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const notify = useCallback((msg: string) => setToast(msg), []);

  const copy = useCallback(
    async (text: string, msg: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notify(msg);
      } catch {
        notify("複製失敗，請改用手動選取");
      }
    },
    [notify],
  );

  const rg = resolveGroup(state);
  const subs = useMemo(() => activeSubs(state), [state]);
  const seed = useMemo(() => seedStock(state), [state]);
  const count = stockCount(state);

  const ctx: PromptContext = useMemo(
    () => ({
      chain: rg.chain,
      chainKind: rg.kind,
      roster: rosterText(state),
      count,
      subNames: subNames(state),
      l2note: rg.l2note,
      wacc: state.wacc,
      target: seed ? `${seed.code} ${seed.name}` : "（尚未指定標的）",
      cards: state.cards,
      ccMode: state.tc.ccMode,
    }),
    [state, rg, count, seed],
  );

  const statusOf = useCallback(
    (st: Station): StationStatus => {
      const missing = (st.needs ?? []).filter((c) => !(state.cards[c] ?? "").trim());
      if (missing.length) {
        return { kind: "wait", label: `缺 ${missing.map((c) => CARD_LABEL[c]).join("、")}` };
      }
      if (st.gate && state.gates[st.id] === st.gate.bad) {
        return { kind: "blocked", label: "閘門未過" };
      }
      if (st.form && cccOf(state.tc).pass === false) {
        return { kind: "blocked", label: "CCC 未過" };
      }
      const ticked = st.checks.filter((_, i) => state.checks[`${st.id}#${i}`]).length;
      const cardOk = !st.card || !!(state.cards[st.card] ?? "").trim();
      if (ticked === st.checks.length && cardOk) return { kind: "done", label: "完成" };
      return { kind: "open", label: `${ticked}/${st.checks.length}` };
    },
    [state],
  );

  const exportLog = () => {
    const L: string[] = [];
    L.push(`# 五層作業流　作業紀錄（${rg.chain}）`);
    L.push("");
    L.push(`- 比較群組：${rg.name}（${rg.chain}${rg.kind === "custom" ? "，自訂產業鏈" : ""}）`);
    L.push(`- 子段：${subNames(state).join("／") || "—"}`);
    L.push(
      `- 掃描名單：${count} 檔${
        rg.kind === "custom"
          ? "（自建個股，段位未定，需自行查證）"
          : state.originalOnly
            ? "（只用教材原表）"
            : "（含補充個股，需查證）"
      }`,
    );
    L.push(`- L3 候選標的：${seed ? `${seed.code} ${seed.name}（${seed.prior}）` : "未指定"}`);
    L.push(`- 資料日期：${state.asOf || "未填"}`);
    L.push("");
    L.push("## 掃描名單");
    L.push("```");
    L.push(rosterText(state));
    L.push("```");
    L.push("");
    for (const st of STATIONS) {
      const s = statusOf(st);
      L.push(`## ${st.no}　${st.title}（${st.tool}）— ${s.label}`);
      if (st.gate) L.push(`- 硬閘門：${st.gate.question} → ${state.gates[st.id] ?? "未回答"}`);
      st.checks.forEach((c, i) => L.push(`  - [${state.checks[`${st.id}#${i}`] ? "x" : " "}] ${c}`));
      if (st.card) {
        const v = (state.cards[st.card] ?? "").trim();
        L.push("");
        L.push(`### ${CARD_LABEL[st.card]}`);
        L.push(v ? "```\n" + v + "\n```" : "_（未填）_");
      }
      if (st.form) {
        L.push("");
        L.push("```");
        L.push(thesisText(state.tc));
        L.push("```");
      }
      L.push("");
    }
    L.push("---");
    L.push("");
    L.push("## 下個月 T+20 對帳（月例會時填）");
    L.push("");
    L.push("| 證偽條件 | 是否觸發 | 有沒有照規則做 | 備註 |");
    L.push("|---|---|---|---|");
    state.tc.falsifiers.forEach((f, i) =>
      L.push(`| 條件 ${i + 1}：${(f.t || "____").replace(/\|/g, "／")} |  |  |  |`),
    );
    L.push("");
    L.push(
      "對帳看的不是賺賠，是「你當初寫的三個證偽條件，有沒有一個被觸發？如果觸發了，你有沒有照規則做？」",
    );
    void copy(L.join("\n"), "作業紀錄已複製，可貼進筆記或回報");
  };

  const offList = state.ticker && !seed && locateTicker(state, state.ticker).length === 0;
  const elsewhere = state.ticker && !seed ? locateTicker(state, state.ticker) : [];

  return (
    <div className="flow-console">
      <PageHeader
        title="五層作業流控制台"
        subtitle="五層作業流．八道指令交棒版　輸入股票代號，產生每一層要用的指令與檢核"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/flow/cards" className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
              我的論點卡
            </Link>
            <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-sm" onClick={exportLog}>
              匯出作業紀錄
            </button>
          </div>
        }
      />

      <RunBar
        runs={runs}
        currentId={runId}
        currentTitle={runName || runTitle(state)}
        status={saveStatus}
        savedAt={savedAt}
        errorMsg={saveError}
        busy={busy}
        onSwitch={(id) => void switchRun(id)}
        onNew={() => void newRun()}
        onFork={() => void forkRun()}
        onRename={renameRun}
        onDelete={() => void removeRun()}
        onSaveNow={() => void doSave()}
      />

      {/* 起手設定 */}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="股票代號" hint="輸入後自動帶出所屬子段與同段名單">
            <Input
              value={state.ticker}
              inputMode="numeric"
              placeholder="1519"
              onChange={(e) => {
                const v = e.target.value.trim();
                update((d) => {
                  d.ticker = v;
                });
                // 目前名單裡有就不跳；教材群組間照舊自動跳；永遠不跳進或跳出自訂產業鏈
                const inCurrent = layout(state).some((sub) => sub.stocks.some((x) => x.code === v));
                if (inCurrent) return;
                const hits = locateTicker(state, v);
                const teach = hits.find((h) => h.group);
                if (rg.kind === "ai" && teach?.group) {
                  const gid = teach.group.id;
                  update((d) => {
                    d.groupId = gid;
                  });
                }
                if (hits.length > 1) {
                  notify(`${v} 橫跨 ${hits.map((h) => h.short).join("、")}，可自行改群組`);
                }
              }}
            />
          </Field>
          <Field label="比較群組">
            <Select
              value={state.groupId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new") {
                  update((d) => {
                    d.open.chains = true;
                  });
                  notify("到下方「自訂產業鏈」按「＋ 新增產業鏈」");
                  return;
                }
                update((d) => {
                  d.groupId = v;
                  const c = d.chains[v];
                  if (c?.wacc) d.wacc = c.wacc;
                });
              }}
            >
              <optgroup label="教材原表（AI 供應鏈）">
                {GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}（{g.subs.length} 子段・{g.src}）
                  </option>
                ))}
              </optgroup>
              <optgroup label="自訂產業鏈">
                {Object.values(state.chains ?? {}).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{c.subs.length} 子段・自建）
                  </option>
                ))}
                <option value="__new">＋ 新增自訂產業鏈…</option>
              </optgroup>
            </Select>
          </Field>
          <Field label="資料日期">
            <Input
              value={state.asOf}
              placeholder="2026/09/30"
              onChange={(e) => {
                const v = e.target.value;
                update((d) => {
                  d.asOf = v;
                });
              }}
            />
          </Field>
          <Field label="參考 WACC（%）" hint="教材範例（AI 電源段）為 8%，其他產業請自行確認">
            <Input
              value={state.wacc}
              onChange={(e) => {
                const v = e.target.value;
                update((d) => {
                  d.wacc = v;
                });
              }}
            />
          </Field>
        </div>

        <div className="gold-rule my-4" />

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-base">
          <Summary k="產業鏈名稱" v={rg.chain} note={rg.kind === "custom" ? "自訂產業鏈・用於 L0 第 ④ 項" : "用於 L0 第 ④ 項"} />
          <Summary k="子段" v={`${subs.length} 段`} note={subNames(state).join("／") || "—"} />
          <Summary k="掃描檔數" v={String(count)} note="L1／L2 前置用" />
          <Summary
            k="L3 候選標的"
            v={
              seed
                ? `${seed.code} ${seed.name}`
                : offList
                  ? `${state.ticker} 不在目前名單裡`
                  : elsewhere.length
                    ? `${state.ticker} 在別的群組`
                    : "待交集卡決定"
            }
            note={
              seed
                ? seed.own
                  ? "段位未定・自建個股"
                  : seed.prior === "未定"
                    ? "段位未定・補充個股待查證"
                    : `${seed.prior}段先驗`
                : elsewhere.length
                  ? `在 ${elsewhere.map((h) => (h.group ? `教材群組「${h.group.name}」` : `自訂產業鏈「${h.short}」`)).join("、")}`
                  : "輸入代號可預先指定"
            }
            tone={offList ? "bad" : elsewhere.length ? "warn" : undefined}
          />
        </div>
      </Card>

      {/* 自訂產業鏈 */}
      <Card className="mb-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() =>
            update((d) => {
              d.open.chains = !(d.open.chains ?? rg.kind === "custom");
            })
          }
        >
          <h2 className="font-display text-lg text-slate-800">
            自訂產業鏈
            <span className="ml-2 text-sm font-normal text-slate-400">
              把同一套作業流套到任何台股：自己命名、拆子段、手打代號與名稱
            </span>
          </h2>
          <span className="text-slate-400">{(state.open.chains ?? rg.kind === "custom") ? "▾" : "▸"}</span>
        </button>
        {(state.open.chains ?? rg.kind === "custom") && (
          <div className="mt-3">
            <ChainEditor state={state} update={update} notify={notify} />
          </div>
        )}
      </Card>

      {offList && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-base text-rose-700">
          <b>「{state.ticker}」不在「{rg.name}」目前的 {count} 檔名單裡。</b>
          <p className="mt-1 leading-relaxed">
            下面八道指令用的仍然是「{rg.name}」這個群組的名單，跟你輸入的代號沒有關係——直接複製會跑錯標的。
            這套流程是「段」導向的：L0 到交集都在做子段之間的橫向比較，需要一整段的同業清單，不是單一個股。
            {rg.kind === "custom"
              ? "請到下方「自訂產業鏈」把它加進某個子段。"
              : "要跑清單外的標的，請在掃描名單的子段按「＋ 加個股」，或建立自訂產業鏈。"}
          </p>
        </div>
      )}

      {/* 五個鐵則 */}
      <Card className="mb-4">
        <h2 className="font-display mb-3 text-lg text-slate-800">五個鐵則</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-base text-slate-600">
          {IRON_RULES.map(([head, body]) => (
            <li key={head}>
              <b className="text-slate-800">{head}</b>
              {body}
            </li>
          ))}
        </ol>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-base">
            <thead>
              <tr className="text-left text-sm uppercase tracking-wider text-slate-400">
                <th className="border-b border-slate-200 px-2 py-2">最常犯的錯</th>
                <th className="border-b border-slate-200 px-2 py-2">會發生什麼</th>
                <th className="border-b border-slate-200 px-2 py-2">怎麼防</th>
              </tr>
            </thead>
            <tbody>
              {COMMON_MISTAKES.map(([a, b, c]) => (
                <tr key={a}>
                  <td className="border-b border-slate-200 px-2 py-2 text-slate-800">{a}</td>
                  <td className="border-b border-slate-200 px-2 py-2 text-slate-600">{b}</td>
                  <td className="border-b border-slate-200 px-2 py-2 text-slate-400">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="font-display mt-5 mb-2 text-lg text-slate-800">這個作業流程讓你帶走三件事</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-base text-slate-600">
          {TAKEAWAYS.map(([head, body]) => (
            <li key={head}>
              <b className="text-slate-800">{head}</b>
              {body}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          這套流程的價值不在於它告訴你買什麼，而在於它逼你把「我憑什麼」拆成八個可以分別被攻擊的環節。
          任何一個環節的證據不夠，整條就停在那裡——這比跑出一個答案有用得多。
        </p>
      </Card>

      {/* 站點 */}
      {STATIONS.map((st) => (
        <StationBlock
          key={st.id}
          station={st}
          state={state}
          ctx={ctx}
          status={statusOf(st)}
          update={update}
          notify={notify}
          copy={copy}
          subs={subs}
          configs={configs}
          isInstructor={isInstructor}
          runId={runId}
        />
      ))}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-base text-slate-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Summary({
  k,
  v,
  note,
  tone,
}: {
  k: string;
  v: string;
  note: string;
  tone?: "warn" | "bad";
}) {
  const color = tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-800";
  return (
    <div className="flex min-w-[110px] flex-col gap-0.5">
      <span className="text-sm uppercase tracking-wider text-slate-400">{k}</span>
      <b className={`text-base font-medium ${color}`}>{v}</b>
      <span className="text-sm text-slate-400">{note}</span>
    </div>
  );
}

function StationBlock({
  station: st,
  state,
  ctx,
  status,
  update,
  notify,
  copy,
  subs,
  configs,
  isInstructor,
  runId,
}: {
  station: Station;
  state: FlowState;
  ctx: PromptContext;
  status: StationStatus;
  update: (fn: (draft: FlowState) => void) => void;
  notify: (m: string) => void;
  copy: (text: string, msg: string) => Promise<void>;
  subs: ReturnType<typeof activeSubs>;
  configs: PublishedConfig[];
  isInstructor: boolean;
  runId: string | null;
}) {
  const open = state.open[st.id] ?? (st.id === "PRE" || status.kind === "blocked");
  const prompt = st.prompt(ctx);
  const missing = (st.needs ?? []).filter((c) => !(state.cards[c] ?? "").trim());

  const flagClass =
    status.kind === "done"
      ? "text-emerald-600"
      : status.kind === "blocked"
        ? "text-rose-600 font-semibold"
        : "text-slate-400";

  return (
    <Card className="mb-3">
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        onClick={() =>
          update((d) => {
            d.open[st.id] = !open;
          })
        }
      >
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-700">
          {st.no}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="font-display text-lg text-slate-800">{st.title}</b>
          <span className="text-sm text-slate-400">
            {st.tool}
            {st.parallel ? `　｜　${st.parallel}` : ""}
          </span>
        </span>
        <span className={`text-sm tabular-nums ${flagClass}`}>{status.label}</span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-slate-600">
            <span>
              <b className="mr-1.5 text-base font-semibold text-slate-500">輸入</b>
              {st.input}
            </span>
            <span>
              <b className="mr-1.5 text-base font-semibold text-slate-500">輸出</b>
              {st.output}
            </span>
          </div>

          {missing.length > 0 && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-base text-rose-700">
              上游還沒交棒：缺 {missing.map((c) => CARD_LABEL[c]).join("、")}
              。指令裡會留著佔位符，先把上一層跑完再複製。
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                {st.form ? "起草指令（選用）" : "指令"}
              </h3>
              <button
                type="button"
                className="btn-ghost rounded px-2.5 py-1 text-sm"
                onClick={() => void copy(prompt, `已複製「${st.title}」指令`)}
              >
                複製指令
              </button>
            </div>
            {ctx.chainKind === "custom" && st.aiOnlyNotice && (
              <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-base text-amber-800">
                <b>AI 供應鏈專用段落・待講師簽核</b>
                <span className="ml-2 text-sm text-amber-700">目前產業鏈：{ctx.chain}</span>
                <p className="mt-1 text-sm leading-relaxed">{st.aiOnlyNotice}</p>
              </div>
            )}
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 border-l-2 border-l-amber-500 bg-white/40 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {prompt}
            </pre>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
              注意事項
            </h3>
            <ul className="space-y-2">
              {st.notes.map((n, i) => (
                <li
                  key={i}
                  className={`border-l-2 pl-3 text-base leading-relaxed ${
                    n.key ? "border-amber-500 text-slate-700" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {n.text}
                  {ctx.chainKind === "custom" && st.aiOnlyNotes?.includes(i) && (
                    <span className="ml-1 rounded border border-amber-400 px-1 text-sm text-amber-700">AI 專用</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {st.id === "L0" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                掃描名單
              </h3>
              <RosterEditor state={state} update={update} notify={notify} configs={configs} isInstructor={isInstructor} />
            </div>
          )}

          {st.id === "L2" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                分組門檻參考
              </h3>
              <ThresholdTable subs={subs} />
            </div>
          )}

          {st.id === "XS" && <MigrationPanels />}
          {st.id === "L3" && <CrsMatrix />}

          {st.form && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                  論點卡
                </h3>
                <span className="text-sm text-slate-400">填完按「儲存到雲端」，換裝置也看得到</span>
              </div>
              <ThesisCardForm state={state} update={update} notify={notify} runId={runId} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                輸出檢核
              </h3>
              <span className="text-sm text-slate-400">全部勾完才算這一層跑完</span>
            </div>
            <ul className="space-y-0.5">
              {st.checks.map((c, i) => {
                const id = `${st.id}#${i}`;
                const on = !!state.checks[id];
                return (
                  <li key={id} className="flex items-start gap-2.5 rounded px-1.5 py-1.5">
                    <input
                      id={`ck-${id}`}
                      type="checkbox"
                      checked={on}
                      className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
                      onChange={(e) => {
                        const v = e.target.checked;
                        update((d) => {
                          d.checks[id] = v;
                        });
                      }}
                    />
                    <label
                      htmlFor={`ck-${id}`}
                      className={`cursor-pointer text-base leading-relaxed ${
                        on ? "text-slate-400 line-through" : "text-slate-600"
                      }`}
                    >
                      {c}
                      {ctx.chainKind === "custom" && st.aiOnlyChecks?.includes(i) && (
                        <span className="ml-1 rounded border border-amber-400 px-1 text-sm text-amber-700">AI 專用</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {st.gate && (
            <GateBlock
              stationId={st.id}
              gate={st.gate}
              value={state.gates[st.id] ?? ""}
              onPick={(v) =>
                update((d) => {
                  d.gates[st.id] = v;
                })
              }
            />
          )}

          {st.card && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                  貼回 {CARD_LABEL[st.card]}
                </h3>
                <span className="text-sm text-slate-400">貼進來，下游指令會自動帶入</span>
              </div>
              <textarea
                value={state.cards[st.card] ?? ""}
                rows={6}
                placeholder={`把 AI 產出的【${CARD_LABEL[st.card]}】整段貼在這裡…`}
                className="w-full rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-2 font-mono text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[rgba(203,161,75,0.25)]"
                onChange={(e) => {
                  const v = e.target.value;
                  const id = st.card as CardId;
                  update((d) => {
                    d.cards[id] = v;
                  });
                }}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function GateBlock({
  stationId,
  gate,
  value,
  onPick,
}: {
  stationId: string;
  gate: NonNullable<Station["gate"]>;
  value: string;
  onPick: (v: string) => void;
}) {
  const tripped = value === gate.bad;
  const passed = !!value && !tripped;
  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        tripped ? "border-rose-500 bg-rose-50" : passed ? "border-emerald-500" : "border-slate-200"
      }`}
    >
      <div
        className="h-1"
        style={{
          background: tripped
            ? "repeating-linear-gradient(135deg,#fb7185 0 9px,transparent 9px 18px)"
            : passed
              ? "#34d399"
              : "repeating-linear-gradient(135deg,var(--gold) 0 9px,transparent 9px 18px)",
        }}
      />
      <div className="space-y-2 px-4 py-3">
        <div className="text-base font-medium text-slate-800">硬閘門｜{gate.question}</div>
        <div className="flex flex-wrap gap-2">
          {gate.options.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-base text-slate-600"
            >
              <input
                type="radio"
                name={`gate-${stationId}`}
                value={o}
                checked={value === o}
                className="accent-amber-600"
                onChange={() => onPick(o)}
              />
              {o}
            </label>
          ))}
        </div>
        {value && (
          <p className={`text-base leading-relaxed ${tripped ? "text-rose-700" : "text-emerald-700"}`}>
            {tripped ? gate.badMessage : gate.okMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function MigrationPanels() {
  const tone: Record<string, string> = {
    領先層: "text-amber-600",
    同步層: "text-sky-400",
    落後層: "text-emerald-600",
  };
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            瓶頸要搬家之前：四個前兆
          </h3>
          <span className="text-sm text-slate-400">按出現順序排</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/40">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-sm uppercase tracking-wider text-slate-400">
                <th className="border-b border-slate-200 px-3 py-2">前兆</th>
                <th className="border-b border-slate-200 px-3 py-2">SLT 層級</th>
                <th className="border-b border-slate-200 px-3 py-2">能不能當進場條件</th>
                <th className="border-b border-slate-200 px-3 py-2">意思</th>
                <th className="border-b border-slate-200 px-3 py-2">目前出現在哪</th>
              </tr>
            </thead>
            <tbody>
              {MIGRATION_SIGNALS.map((m) => (
                <tr key={m.n}>
                  <td className="border-b border-slate-200 px-3 py-2 whitespace-nowrap text-slate-800">
                    <span className="mr-1.5 text-sm font-semibold text-amber-600">{m.n}</span>
                    {m.signal}
                  </td>
                  <td className={`border-b border-slate-200 px-3 py-2 whitespace-nowrap ${tone[m.layer]}`}>
                    {m.layer}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-slate-600">{m.use}</td>
                  <td className="border-b border-slate-200 px-3 py-2 text-slate-600">{m.meaning}</td>
                  <td className="border-b border-slate-200 px-3 py-2 text-slate-400">{m.examples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          超額利潤會搬家，而且它搬走的時候，財報是最後才知道的。抓到遷移的時點，比抓到個股重要。
          這四個訊號正好可以用 SLT 三層分級套：前兩個是領先層（可作觸發器），第三個同步層（只能加權），第四個落後層（禁止當進場條件）。
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            租金三階段
          </h3>
          <span className="text-sm text-slate-400">交集判「矛盾」時，用這張表分辨解釋 A 還是 B</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {RENT_PHASES.map((r) => {
            const border =
              r.tone === "ok"
                ? "border-emerald-500"
                : r.tone === "warn"
                  ? "border-amber-500"
                  : "border-rose-500";
            const act =
              r.tone === "ok"
                ? "text-emerald-600"
                : r.tone === "warn"
                  ? "text-amber-600"
                  : "text-rose-600";
            return (
              <div key={r.key} className={`space-y-1 rounded-xl border bg-white/40 px-3 py-3 ${border}`}>
                <b className="font-display text-base text-slate-800">{r.key}</b>
                <p className="text-sm text-slate-600">{r.feature}</p>
                <p className="text-sm text-slate-600">{r.money}</p>
                <p className={`text-base font-medium ${act}`}>{r.action}</p>
              </div>
            );
          })}
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          如果 L1 資金指向這一段，但 L2 顯示毛利率已經見頂、擴產宣告變多——那資金不是在提前反應，是在追一段已經結束的行情。
          這就是解釋 B：追消散的租金。千萬別在租金消散之後才進場。
        </p>
      </div>
    </div>
  );
}

function CrsMatrix() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          CRS 分級撤退 × 段位
        </h3>
        <span className="text-sm text-slate-400">燈號升級時，先砍哪一段</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/40">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-sm uppercase tracking-wider text-slate-400">
              {CRS_MATRIX.head.map((h) => (
                <th key={h} className="border-b border-slate-200 px-3 py-2 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRS_MATRIX.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={`border-b border-slate-200 px-3 py-2 whitespace-nowrap ${
                      i === 0 ? "font-medium text-slate-800" : "text-slate-600"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        這張表請自己調整——撤退順序取決於你對每一段護城河強度的判斷，上面給的是原則不是答案。
        把它填進你自己的 CRS 分級撤退表之後，燈號就從「風險溫度計」變成「可執行的部位指令」。
      </p>
    </div>
  );
}
