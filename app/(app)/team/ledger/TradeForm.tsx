import { Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Trade = {
  id: string;
  trade_date: string | null;
  symbol: string | null;
  direction: string | null;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_pct: number | null;
  rationale: string | null;
  invalidation: string | null;
  result: string | null;
  attribution: string | null;
};

export function TradeForm({
  action,
  trade,
}: {
  action: (formData: FormData) => Promise<void>;
  trade?: Trade;
}) {
  return (
    <form action={action} className="mt-4 space-y-4">
      {trade && <input type="hidden" name="id" value={trade.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="日期" required>
          <Input
            type="date"
            name="trade_date"
            required
            defaultValue={trade?.trade_date ?? undefined}
          />
        </Field>
        <Field label="標的" required>
          <Input
            name="symbol"
            placeholder="如 2330 / AAPL"
            required
            defaultValue={trade?.symbol ?? undefined}
          />
        </Field>
        <Field label="方向">
          <Select name="direction" defaultValue={trade?.direction ?? "buy"}>
            <option value="buy">買進</option>
            <option value="sell">賣出</option>
          </Select>
        </Field>
        <Field label="進場價">
          <Input name="entry" type="number" step="any" defaultValue={trade?.entry ?? undefined} />
        </Field>
        <Field label="停損" required>
          <Input
            name="stop_loss"
            type="number"
            step="any"
            required
            defaultValue={trade?.stop_loss ?? undefined}
          />
        </Field>
        <Field label="停利">
          <Input
            name="take_profit"
            type="number"
            step="any"
            defaultValue={trade?.take_profit ?? undefined}
          />
        </Field>
        <Field label="倉位 %">
          <Input
            name="position_pct"
            type="number"
            step="any"
            defaultValue={trade?.position_pct ?? undefined}
          />
        </Field>
      </div>
      <Field label="決策理由（可證偽）" hint="須「可被未來數據推翻」，不可寫「我覺得會漲」" required>
        <Textarea name="rationale" required defaultValue={trade?.rationale ?? undefined} />
      </Field>
      <Field label="失效條件">
        <Textarea name="invalidation" defaultValue={trade?.invalidation ?? undefined} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="結果（模擬賺賠）">
          <Input name="result" placeholder="如 +3.2% / -1.5%" defaultValue={trade?.result ?? undefined} />
        </Field>
        <Field label="歸因" hint="環境 / 時機 / 選股 / 執行 哪一環">
          <Input name="attribution" defaultValue={trade?.attribution ?? undefined} />
        </Field>
      </div>
      <SubmitButton>{trade ? "儲存修改" : "新增決策"}</SubmitButton>
    </form>
  );
}
