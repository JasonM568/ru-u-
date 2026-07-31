import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Pred = { pred?: string | null; actual?: string | null; hit?: boolean };
type Predictions = { env?: Pred; market?: Pred; symbol?: Pred; execution?: Pred };

type Review = {
  id: string;
  review_date: string | null;
  predictions: Predictions | null;
  pnl: string | null;
  attribution: string | null;
  lesson: string | null;
  root_cause: string | null;
  guardrail: string | null;
  repeated: boolean | null;
  repeated_note: string | null;
};

const PRED_ROWS = [
  { k: "env", pk: "env", label: "環境方向" },
  { k: "market", pk: "market", label: "大盤走勢" },
  { k: "symbol", pk: "symbol", label: "個股／標的" },
  { k: "exec", pk: "execution", label: "進出場執行" },
] as const;

export function ReviewForm({
  action,
  review,
}: {
  action: (formData: FormData) => Promise<void>;
  review?: Review;
}) {
  const preds = review?.predictions ?? {};
  return (
    <form action={action} className="mt-4 space-y-4">
      {review && <input type="hidden" name="id" value={review.id} />}
      <Field label="覆盤日期" required>
        <Input
          type="date"
          name="review_date"
          required
          defaultValue={review?.review_date ?? undefined}
        />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          1. 預測 vs 實際
        </p>
        <div className="space-y-3">
          {PRED_ROWS.map((row) => {
            const p: Pred = preds[row.pk] ?? {};
            return (
              <div key={row.k} className="grid items-center gap-2 sm:grid-cols-[90px_1fr_1fr_auto]">
                <span className="text-xs text-slate-500">{row.label}</span>
                <Input
                  name={`${row.k}_pred`}
                  placeholder="當初預測"
                  defaultValue={p.pred ?? undefined}
                />
                <Input
                  name={`${row.k}_actual`}
                  placeholder="實際結果"
                  defaultValue={p.actual ?? undefined}
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" name={`${row.k}_hit`} defaultChecked={!!p.hit} /> 命中
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="本期賺賠（模擬）">
          <Input name="pnl" defaultValue={review?.pnl ?? undefined} />
        </Field>
        <Field label="真正原因拆解" hint="環境 / 選股 / 時機 / 執行">
          <Input name="attribution" defaultValue={review?.attribution ?? undefined} />
        </Field>
      </div>

      <Field label="這次的教訓">
        <Textarea name="lesson" defaultValue={review?.lesson ?? undefined} />
      </Field>
      <Field label="根本原因">
        <Textarea name="root_cause" defaultValue={review?.root_cause ?? undefined} />
      </Field>
      <Field label="下次的護欄" hint="要新增什麼規則來避免重犯">
        <Textarea name="guardrail" defaultValue={review?.guardrail ?? undefined} />
      </Field>

      <div className="rounded-lg bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="repeated" defaultChecked={!!review?.repeated} /> 是否重複犯了同樣的錯？（勾選＝之前也發生過，代表護欄沒建好）
        </label>
        <div className="mt-2">
          <Textarea
            name="repeated_note"
            placeholder="說明"
            defaultValue={review?.repeated_note ?? undefined}
          />
        </div>
      </div>

      <SubmitButton>{review ? "儲存修改" : "儲存覆盤"}</SubmitButton>
    </form>
  );
}
