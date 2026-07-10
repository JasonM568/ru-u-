import { PART1, PART2, PART3, LIKERT_LABELS } from "@/lib/questionnaire";
import type { Answers } from "@/lib/scoring";

// 唯讀呈現問卷題目；若給了 answers 則標示該學員的作答。
export function QuestionnaireReview({ answers }: { answers?: Answers }) {
  const has = !!answers && Object.keys(answers).length > 0;

  return (
    <div className="space-y-5 text-sm">
      <Section title="第一部分　認知風格傾向">
        {[...PART1].map((q, i) => (
          <ChoiceRow
            key={q.id}
            n={i + 1}
            text={q.text}
            options={q.options}
            picked={answers?.[q.id] as string | undefined}
            showPick={has}
          />
        ))}
      </Section>

      <Section title="第二部分　風險與決斷傾向">
        {[...PART2].map((q, i) => (
          <ChoiceRow
            key={q.id}
            n={i + 8}
            text={q.text}
            options={q.options}
            picked={answers?.[q.id] as string | undefined}
            showPick={has}
          />
        ))}
      </Section>

      <Section title="第三部分　協作角色傾向（1–5）">
        {PART3.map((q, i) => {
          const v = answers?.[q.id] as number | undefined;
          return (
            <div key={q.id} className="border-b border-slate-100 pb-2 last:border-0">
              <p className="text-slate-700">
                {i + 15}. {q.text}
              </p>
              {has && (
                <p className="mt-1 text-xs">
                  {v ? (
                    <span className="font-medium text-indigo-600">
                      {v} — {LIKERT_LABELS.find((l) => l.value === v)?.label}
                    </span>
                  ) : (
                    <span className="text-slate-500">未作答</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 border-l-4 border-indigo-500 pl-2 font-semibold text-slate-800">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ChoiceRow({
  n,
  text,
  options,
  picked,
  showPick,
}: {
  n: number;
  text: string;
  options: { key: string; text: string }[];
  picked?: string;
  showPick: boolean;
}) {
  return (
    <div className="border-b border-slate-100 pb-2 last:border-0">
      <p className="text-slate-700">
        {n}. {text}
      </p>
      <div className="mt-1 space-y-0.5">
        {options.map((o) => {
          const active = showPick && picked === o.key;
          return (
            <p
              key={o.key}
              className={
                active
                  ? "font-medium text-indigo-600"
                  : "text-xs text-slate-400"
              }
            >
              <b className="mr-1">{o.key}.</b>
              {o.text}
              {active && " ✓"}
            </p>
          );
        })}
        {showPick && !picked && (
          <p className="text-xs text-slate-500">未作答</p>
        )}
      </div>
    </div>
  );
}
