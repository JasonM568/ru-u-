"use client";

import { Field, Input, Select, Textarea } from "@/components/ui";
import { pct } from "@/lib/flow/ccc";
import { cccOf, thesisText } from "@/lib/flow/thesis";
import { cardIsEmpty } from "@/lib/flow/cloud";
import { saveThesisCard } from "./actions";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  FALSIFIER_LEVELS,
  falsifierStatus,
  type FlowState,
  type ThesisCard,
} from "@/lib/flow/state";
import { ATTACK_FORBIDDEN, ATTACK_MAP } from "@/lib/flow/segments";

const CLASSES = ["", "瓶頸段", "通過段", "被替代段", "循環段", "不歸類（形成期）"];
const FORMS = ["", "分批", "一次到位", "不進場"];

export { cccOf, thesisText };

function Section({
  title,
  from,
  children,
}: {
  title: string;
  from: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600">{title}</h4>
        <span className="text-sm text-slate-400">{from}</span>
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </div>
  );
}

export function ThesisCardForm({
  state,
  update,
  notify,
  runId = null,
}: {
  state: FlowState;
  update: (fn: (draft: FlowState) => void) => void;
  notify: (msg: string) => void;
  runId?: string | null;
}) {
  const tc = state.tc;
  const c = cccOf(tc);
  const len = [...tc.thesis].length;
  const fs = falsifierStatus(tc);
  const set = (fn: (card: ThesisCard) => void) => update((d) => fn(d.tc));
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<string>("");

  const saveToCloud = () =>
    startSaving(async () => {
      if (cardIsEmpty(tc)) {
        notify("至少填標的代號、名稱或核心論點，再存雲端");
        return;
      }
      const res = await saveThesisCard({
        card: JSON.stringify(tc),
        groupId: state.groupId,
        asOf: state.asOf,
        runId,
      });
      if (!res.ok) {
        notify(`存雲端失敗：${res.error}`);
        return;
      }
      update((d) => void (d.tc.id = res.id));
      setSavedAt(res.updatedAt);
      notify("論點卡已存到雲端");
    });

  const toneClass =
    fs.tone === "bad" ? "text-rose-600" : fs.tone === "warn" ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="space-y-4">
      <Section title="標的" from="來自 交集卡 ＋ L2 交棒卡">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="名稱">
            <Input value={tc.name} onChange={(e) => set((t) => void (t.name = e.target.value))} />
          </Field>
          <Field label="代號">
            <Input value={tc.code} onChange={(e) => set((t) => void (t.code = e.target.value))} />
          </Field>
          <Field label="子段">
            <Input value={tc.sub} onChange={(e) => set((t) => void (t.sub = e.target.value))} />
          </Field>
          <Field label="分類" hint="段位，不是好壞評價">
            <Select value={tc.cls} onChange={(e) => set((t) => void (t.cls = e.target.value))}>
              {CLASSES.map((o) => (
                <option key={o} value={o}>
                  {o || "（未選）"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="填寫日期">
            <Input
              value={tc.date}
              placeholder="2026/09/30"
              onChange={(e) => set((t) => void (t.date = e.target.value))}
            />
          </Field>
        </div>
      </Section>

      <Section title="一、核心論點" from="來自 L3 交棒卡．限 40 字">
        <Field
          label="什麼是瓶頸／為什麼短期解不開／這家公司在瓶頸的什麼位置"
          hint={`${len} / 40 字`}
        >
          <Textarea
            value={tc.thesis}
            rows={3}
            placeholder="電力是實體瓶頸，變壓器交期以年計，在手訂單排至 2028 年，租金短期不會消散。"
            onChange={(e) => set((t) => void (t.thesis = e.target.value))}
          />
        </Field>
        {len > 40 && (
          <p className="text-sm text-rose-600">
            超過 40 字。講不清楚代表想不清楚——先想清楚再壓縮，不要只是刪字。
          </p>
        )}
      </Section>

      <Section title="二、三個支撐證據" from="來自 L1 ＋ L2 原始表．每個都要有數字、來源、期別">
        {tc.evidence.map((e, i) => (
          <div key={i} className="grid gap-2 lg:grid-cols-[1fr_150px_130px]">
            <Field label={`證據 ${i + 1}（要有數字）`}>
              <Textarea
                rows={2}
                value={e.t}
                onChange={(ev) => set((t) => void (t.evidence[i].t = ev.target.value))}
              />
            </Field>
            <Field label="來源">
              <Input
                value={e.src}
                placeholder="公司財報"
                onChange={(ev) => set((t) => void (t.evidence[i].src = ev.target.value))}
              />
            </Field>
            <Field label="期別">
              <Input
                value={e.per}
                placeholder="2026Q2"
                onChange={(ev) => set((t) => void (t.evidence[i].per = ev.target.value))}
              />
            </Field>
          </div>
        ))}
        <p className="text-sm text-slate-400">
          三個證據最好來自三個不同角度：一個財報數字、一個公司揭露、一個產業側面。全部來自財報，等於只有一個角度。
        </p>
      </Section>

      <Section title="三、三個證偽條件" from="來自 L3 的 BSA．全卡最重要的一欄">
        {tc.falsifiers.map((f, i) => (
          <div key={i} className="grid gap-2 lg:grid-cols-[1fr_160px_120px]">
            <Field label={`條件 ${i + 1}：若出現以下情況，本論點失效`}>
              <Textarea
                rows={2}
                value={f.t}
                onChange={(ev) => set((t) => void (t.falsifiers[i].t = ev.target.value))}
              />
            </Field>
            <Field label="檢查時點">
              <Input
                value={f.when}
                placeholder="2026/11 財報"
                onChange={(ev) => set((t) => void (t.falsifiers[i].when = ev.target.value))}
              />
            </Field>
            <Field label="涵蓋層次">
              <Select
                value={f.lvl}
                onChange={(ev) =>
                  set(
                    (t) =>
                      void (t.falsifiers[i].lvl = ev.target
                        .value as (typeof FALSIFIER_LEVELS)[number]),
                  )
                }
              >
                {FALSIFIER_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ))}
        <p className={`text-sm ${toneClass}`}>{fs.message}</p>
      </Section>

      <Section title="四、最大單一雷點" from="來自 L3 風險情境．如果只能擔心一件事">
        <Field label="它會在財報的哪個科目、什麼時點第一次出現？">
          <Textarea
            rows={3}
            value={tc.bomb}
            onChange={(e) => set((t) => void (t.bomb = e.target.value))}
          />
        </Field>
      </Section>

      <Section title="五、確認條件成本（CCC）" from="來自 L3 ＋ L4 交棒卡．超過 33% 本案不成立">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="現價">
            <Input
              type="number"
              step="any"
              value={tc.px}
              onChange={(e) => set((t) => void (t.px = e.target.value))}
            />
          </Field>
          <Field label="L3 確認價（基本面閘門）">
            <Input
              type="number"
              step="any"
              value={tc.p3}
              onChange={(e) => set((t) => void (t.p3 = e.target.value))}
            />
          </Field>
          <Field label="L4 確認價（技術確認）">
            <Input
              type="number"
              step="any"
              value={tc.p4}
              onChange={(e) => set((t) => void (t.p4 = e.target.value))}
            />
          </Field>
          <Field label="預期報酬" hint="0.35 ＝ 35%">
            <Input
              type="number"
              step="any"
              value={tc.expectedReturn}
              onChange={(e) => set((t) => void (t.expectedReturn = e.target.value))}
            />
          </Field>
          <Field label="合計規則" hint="全隊須一致">
            <Select
              value={tc.ccMode}
              onChange={(e) =>
                set((t) => void (t.ccMode = e.target.value === "sum" ? "sum" : "max"))
              }
            >
              <option value="max">取較高者（同一次上漲同時滿足）</option>
              <option value="sum">相加（先後獨立的兩道關卡）</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <CalcBox label="L3 確認成本" value={pct(c.l3)} />
          <CalcBox label="L4 確認成本" value={pct(c.l4)} />
          <CalcBox label="合計確認成本" value={pct(c.total)} />
          <CalcBox label="佔預期報酬" value={pct(c.ratio)} />
          <CalcBox
            label="33% 硬閘門"
            value={c.pass === null ? "待填" : c.pass ? "通過" : "本案不成立"}
            tone={c.pass === null ? undefined : c.pass ? "ok" : "bad"}
          />
        </div>

        {c.pass === false && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-base font-medium text-rose-700">
            合計確認成本吃掉超過三分之一的預期報酬 → 回 L3 換標的。不管公司多好、價格多便宜。
          </p>
        )}
      </Section>

      <Section title="六、部位規劃" from="來自 L3 ＋ L4 交棒卡．含 CRS 連動">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="形式">
            <Select
              value={tc.positionForm}
              onChange={(e) => set((t) => void (t.positionForm = e.target.value))}
            >
              {FORMS.map((o) => (
                <option key={o} value={o}>
                  {o || "（未選）"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="進場價帶下緣" hint="L3 與 L4 的重疊區">
            <Input value={tc.bandLow} onChange={(e) => set((t) => void (t.bandLow = e.target.value))} />
          </Field>
          <Field label="上緣">
            <Input
              value={tc.bandHigh}
              onChange={(e) => set((t) => void (t.bandHigh = e.target.value))}
            />
          </Field>
          <Field label="部位上限" hint="佔總資金，例 0.08">
            <Input
              value={tc.positionCap}
              onChange={(e) => set((t) => void (t.positionCap = e.target.value))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="第一段觸發">
            <Input
              value={tc.tr1}
              placeholder="≤105（1/3）"
              onChange={(e) => set((t) => void (t.tr1 = e.target.value))}
            />
          </Field>
          <Field label="第二段觸發">
            <Input
              value={tc.tr2}
              placeholder="≤95（1/3）"
              onChange={(e) => set((t) => void (t.tr2 = e.target.value))}
            />
          </Field>
          <Field label="第三段觸發">
            <Input
              value={tc.tr3}
              placeholder="≤84（1/3）"
              onChange={(e) => set((t) => void (t.tr3 = e.target.value))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CRS 升一級時的處置">
            <Input
              value={tc.crsUp1}
              placeholder="停止加碼，既有部位不動"
              onChange={(e) => set((t) => void (t.crsUp1 = e.target.value))}
            />
          </Field>
          <Field label="CRS 升兩級時的處置">
            <Input
              value={tc.crsUp2}
              placeholder="減碼至 1/2"
              onChange={(e) => set((t) => void (t.crsUp2 = e.target.value))}
            />
          </Field>
        </div>
        <p className="text-sm text-slate-400">事前寫好，不是當下才想。</p>
      </Section>

      <Section title="七、我可能錯在哪" from="自己寫．最難，也最重要">
        <Field label="不是公司的風險，是「我這個判斷本身的弱點」——我的推論鏈上最脆弱的那一環">
          <Textarea
            rows={4}
            value={tc.weakness}
            onChange={(e) => set((t) => void (t.weakness = e.target.value))}
          />
        </Field>
        <p className="text-sm leading-relaxed text-slate-400">
          ✕「市場競爭可能加劇」——那是公司的風險。
          <br />
          ○「我把交期長當成護城河，但交期長也可能只是產能不足的暫時現象。」
        </p>
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-gold rounded-lg px-4 py-2 text-base disabled:opacity-60"
          disabled={saving}
          onClick={saveToCloud}
        >
          {saving ? "儲存中…" : tc.id ? "更新雲端這張卡" : "儲存到雲端"}
        </button>
        <span className="text-sm text-slate-400">
          {tc.id ? (
            <>
              已存雲端{savedAt ? `（${new Date(savedAt).toLocaleTimeString("zh-TW", { hour12: false })}）` : ""}
              　<Link href="/flow/cards" className="text-[color:var(--gold)] underline-offset-2 hover:underline">看我的論點卡</Link>
            </>
          ) : (
            "尚未存雲端，目前只在這台裝置的瀏覽器裡"
          )}
        </span>
        <button
          type="button"
          className="btn-ghost rounded-lg px-4 py-2 text-base"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(thesisText(tc));
              notify("論點卡已複製");
            } catch {
              notify("複製失敗，請改用手動選取");
            }
          }}
        >
          複製整張論點卡
        </button>
        <button
          type="button"
          className="btn-ghost rounded-lg px-4 py-2 text-base"
          onClick={() => {
            if (!window.confirm("清空這張論點卡？其他層的交棒卡不受影響。")) return;
            update((d) => {
              d.tc = { ...d.tc, ...blankFields() };
              delete d.tc.id;
            });
            setSavedAt("");
            notify("論點卡已清空（雲端那張不受影響，這裡變成一張新卡）");
          }}
        >
          清空這張卡
        </button>
      </div>

      <AttackMap />
    </div>
  );
}

function blankFields() {
  return {
    code: "",
    name: "",
    sub: "",
    cls: "",
    date: "",
    thesis: "",
    evidence: [
      { t: "", src: "", per: "" },
      { t: "", src: "", per: "" },
      { t: "", src: "", per: "" },
    ] as ThesisCard["evidence"],
    falsifiers: [
      { t: "", when: "", lvl: "公司自身" },
      { t: "", when: "", lvl: "供給端" },
      { t: "", when: "", lvl: "需求端" },
    ] as ThesisCard["falsifiers"],
    bomb: "",
    px: "",
    p3: "",
    p4: "",
    expectedReturn: "",
    positionForm: "",
    bandLow: "",
    bandHigh: "",
    tr1: "",
    tr2: "",
    tr3: "",
    positionCap: "",
    crsUp1: "",
    crsUp2: "",
    weakness: "",
  };
}

function CalcBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  const box =
    tone === "ok"
      ? "border-emerald-500 bg-emerald-50"
      : tone === "bad"
        ? "border-rose-500 bg-rose-50"
        : "border-slate-200 bg-white";
  const text =
    tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-900";
  return (
    <div className={`rounded-lg border px-3 py-2 ${box}`}>
      <div className="text-sm uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-xl font-medium tabular-nums ${text}`}>{value}</div>
    </div>
  );
}

function AttackMap() {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
        交叉詰問攻擊地圖
      </h4>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/40">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-sm uppercase tracking-wider text-slate-400">
              <th className="border-b border-slate-200 px-3 py-2">攻擊點</th>
              <th className="border-b border-slate-200 px-3 py-2">對手隊會問</th>
              <th className="border-b border-slate-200 px-3 py-2">什麼樣的回答算過關</th>
            </tr>
          </thead>
          <tbody>
            {ATTACK_MAP.map(([point, q, pass], i) => (
              <tr key={i}>
                <td className="border-b border-slate-200 px-3 py-2 whitespace-nowrap text-slate-800">
                  {point}
                </td>
                <td className="border-b border-slate-200 px-3 py-2 text-slate-600">{q}</td>
                <td className="border-b border-slate-200 px-3 py-2 text-slate-400">{pass}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-sm text-slate-400">
        {ATTACK_FORBIDDEN.map((x) => (
          <li key={x}>— {x}</li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed text-slate-400">
        交叉詰問的目的不是駁倒對方，是幫他找出論點裡自己看不到的洞。被問倒的人如果當場把缺口記下來，這一輪就成功了。
      </p>
    </div>
  );
}
