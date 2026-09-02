"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, PageHeader, Field, Input, Select } from "@/components/ui";
import {
  CRS_MATRIX,
  GROUPS,
  MIGRATION_SIGNALS,
  RENT_PHASES,
  SEGMENTS,
  groupById,
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
  locateTicker,
  rosterText,
  seedStock,
  stockCount,
  subNames,
  type FlowState,
} from "@/lib/flow/state";
import { RosterEditor, ThresholdTable } from "./RosterEditor";
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

export function FlowConsole({ userId }: { userId: string }) {
  const storageKey = `flow5:${userId}`;
  const [state, setState] = useState<FlowState>(() => loadState(storageKey));
  const [toast, setToast] = useState("");

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

  const group = groupById(state.groupId);
  const subs = useMemo(() => activeSubs(state), [state]);
  const seed = useMemo(() => seedStock(state), [state]);
  const count = stockCount(state);

  const ctx: PromptContext = useMemo(
    () => ({
      chain: group.chain,
      roster: rosterText(state),
      count,
      subNames: subNames(state),
      l2note: group.l2note,
      wacc: state.wacc,
      target: seed ? `${seed.code} ${seed.name}` : "（尚未指定標的）",
      cards: state.cards,
      ccMode: state.tc.ccMode,
    }),
    [state, group, count, seed],
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
    L.push("# AI 供應鏈五層作業流　作業紀錄");
    L.push("");
    L.push(`- 比較群組：${group.name}（${group.chain}）`);
    L.push(`- 子段：${subNames(state).join("／") || "—"}`);
    L.push(
      `- 掃描名單：${count} 檔${
        state.originalOnly ? "（只用教材原表）" : "（含補充個股，需查證）"
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
    <div>
      <PageHeader
        title="五層作業流控制台"
        subtitle="AI 供應鏈．八道指令交棒版　輸入股票代號，產生每一層要用的指令與檢核"
        action={
          <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-xs" onClick={exportLog}>
            匯出作業紀錄
          </button>
        }
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
                const hits = locateTicker(state, v);
                if (hits.length && hits[0].group) {
                  const gid = hits[0].group.id;
                  if (!group.subs.some((s) => SEGMENTS[s].stocks.some((x) => x.code === v))) {
                    update((d) => {
                      d.groupId = gid;
                    });
                  }
                  if (hits.length > 1) {
                    notify(`${v} 橫跨 ${hits.map((h) => h.short).join("、")}，可自行改群組`);
                  }
                }
              }}
            />
          </Field>
          <Field label="比較群組">
            <Select
              value={state.groupId}
              onChange={(e) => {
                const v = e.target.value;
                update((d) => {
                  d.groupId = v;
                });
              }}
            >
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}（{g.subs.length} 子段・{g.src}）
                </option>
              ))}
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
          <Field label="參考 WACC（%）" hint="教材給的是電源段 8%，其他段請自行確認">
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

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Summary k="產業鏈名稱" v={group.chain} note="用於 L0 第 ④ 項" />
          <Summary k="子段" v={`${subs.length} 段`} note={subNames(state).join("／") || "—"} />
          <Summary k="掃描檔數" v={String(count)} note="L1／L2 前置用" />
          <Summary
            k="L3 候選標的"
            v={
              seed
                ? `${seed.code} ${seed.name}`
                : offList
                  ? `${state.ticker} 不在這 74 檔裡`
                  : elsewhere.length
                    ? `${state.ticker} 在別的群組`
                    : "待交集卡決定"
            }
            note={
              seed
                ? seed.prior === "未定"
                  ? "段位未定・補充個股待查證"
                  : `${seed.prior}段先驗`
                : elsewhere.length
                  ? `屬於 ${elsewhere.map((h) => h.short).join("、")}`
                  : "輸入代號可預先指定"
            }
            tone={offList ? "bad" : elsewhere.length ? "warn" : undefined}
          />
        </div>
      </Card>

      {offList && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <b>「{state.ticker}」不在本表的 74 檔 AI 供應鏈清單裡。</b>
          <p className="mt-1 leading-relaxed">
            下面八道指令用的仍然是「{group.name}」這個群組的名單，跟你輸入的代號沒有關係——直接複製會跑錯標的。
            這套流程是「段」導向的：L0 到交集都在做子段之間的橫向比較，需要一整段的同業清單，不是單一個股。
            要跑清單外的標的，請在「掃描名單」自行增刪。
          </p>
        </div>
      )}

      {/* 五個鐵則 */}
      <Card className="mb-4">
        <h2 className="font-display mb-3 text-base text-slate-800">五個鐵則</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          {IRON_RULES.map(([head, body]) => (
            <li key={head}>
              <b className="text-slate-800">{head}</b>
              {body}
            </li>
          ))}
        </ol>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
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

        <h2 className="font-display mt-5 mb-2 text-base text-slate-800">今晚帶走三件事</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          {TAKEAWAYS.map(([head, body]) => (
            <li key={head}>
              <b className="text-slate-800">{head}</b>
              {body}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
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
        />
      ))}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-slate-50 shadow-lg">
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
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{k}</span>
      <b className={`text-sm font-medium ${color}`}>{v}</b>
      <span className="text-[11px] text-slate-400">{note}</span>
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
}: {
  station: Station;
  state: FlowState;
  ctx: PromptContext;
  status: StationStatus;
  update: (fn: (draft: FlowState) => void) => void;
  notify: (m: string) => void;
  copy: (text: string, msg: string) => Promise<void>;
  subs: ReturnType<typeof activeSubs>;
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
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          {st.no}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="font-display text-base text-slate-800">{st.title}</b>
          <span className="text-xs text-slate-400">
            {st.tool}
            {st.parallel ? `　｜　${st.parallel}` : ""}
          </span>
        </span>
        <span className={`text-xs tabular-nums ${flagClass}`}>{status.label}</span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>
              <b className="mr-1.5 text-[10px] uppercase tracking-wider text-slate-400">輸入</b>
              {st.input}
            </span>
            <span>
              <b className="mr-1.5 text-[10px] uppercase tracking-wider text-slate-400">輸出</b>
              {st.output}
            </span>
          </div>

          {missing.length > 0 && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              上游還沒交棒：缺 {missing.map((c) => CARD_LABEL[c]).join("、")}
              。指令裡會留著佔位符，先把上一層跑完再複製。
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                {st.form ? "起草指令（選用）" : "指令"}
              </h3>
              <button
                type="button"
                className="btn-ghost rounded px-2.5 py-1 text-xs"
                onClick={() => void copy(prompt, `已複製「${st.title}」指令`)}
              >
                複製指令
              </button>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 border-l-2 border-l-amber-500 bg-white/40 px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-700">
              {prompt}
            </pre>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              注意事項
            </h3>
            <ul className="space-y-2">
              {st.notes.map((n, i) => (
                <li
                  key={i}
                  className={`border-l-2 pl-3 text-sm leading-relaxed ${
                    n.key ? "border-amber-500 text-slate-700" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {n.text}
                </li>
              ))}
            </ul>
          </div>

          {st.id === "L0" && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                掃描名單
              </h3>
              <RosterEditor state={state} update={update} notify={notify} />
            </div>
          )}

          {st.id === "L2" && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
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
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  論點卡
                </h3>
                <span className="text-[11px] text-slate-400">目前存在這台裝置的瀏覽器裡</span>
              </div>
              <ThesisCardForm state={state} update={update} notify={notify} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                輸出檢核
              </h3>
              <span className="text-[11px] text-slate-400">全部勾完才算這一層跑完</span>
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
                      className={`cursor-pointer text-sm leading-relaxed ${
                        on ? "text-slate-400 line-through" : "text-slate-600"
                      }`}
                    >
                      {c}
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
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  貼回 {CARD_LABEL[st.card]}
                </h3>
                <span className="text-[11px] text-slate-400">貼進來，下游指令會自動帶入</span>
              </div>
              <textarea
                value={state.cards[st.card] ?? ""}
                rows={6}
                placeholder={`把 AI 產出的【${CARD_LABEL[st.card]}】整段貼在這裡…`}
                className="w-full rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[rgba(203,161,75,0.25)]"
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
        <div className="text-sm font-medium text-slate-800">硬閘門｜{gate.question}</div>
        <div className="flex flex-wrap gap-2">
          {gate.options.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600"
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
          <p className={`text-sm leading-relaxed ${tripped ? "text-rose-700" : "text-emerald-700"}`}>
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
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            瓶頸要搬家之前：四個前兆
          </h3>
          <span className="text-[11px] text-slate-400">按出現順序排</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/40">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
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
                    <span className="mr-1.5 text-[11px] font-semibold text-amber-600">{m.n}</span>
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
        <p className="text-xs leading-relaxed text-slate-600">
          超額利潤會搬家，而且它搬走的時候，財報是最後才知道的。抓到遷移的時點，比抓到個股重要。
          這四個訊號正好可以用 SLT 三層分級套：前兩個是領先層（可作觸發器），第三個同步層（只能加權），第四個落後層（禁止當進場條件）。
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            租金三階段
          </h3>
          <span className="text-[11px] text-slate-400">交集判「矛盾」時，用這張表分辨解釋 A 還是 B</span>
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
                <b className="font-display text-sm text-slate-800">{r.key}</b>
                <p className="text-xs text-slate-600">{r.feature}</p>
                <p className="text-xs text-slate-600">{r.money}</p>
                <p className={`text-sm font-medium ${act}`}>{r.action}</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
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
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          CRS 分級撤退 × 段位
        </h3>
        <span className="text-[11px] text-slate-400">燈號升級時，先砍哪一段</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/40">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
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
      <p className="text-xs leading-relaxed text-slate-600">
        這張表請自己調整——撤退順序取決於你對每一段護城河強度的判斷，上面給的是原則不是答案。
        把它填進你自己的 CRS 分級撤退表之後，燈號就從「風險溫度計」變成「可執行的部位指令」。
      </p>
    </div>
  );
}
