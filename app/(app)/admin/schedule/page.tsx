import { requireInstructor } from "@/lib/auth";
import { Card, PageHeader, Badge } from "@/components/ui";

type Slot = {
  time: string;
  title: string;
  module?: string;
  content: string;
  star?: string;
};

const DAY1: Slot[] = [
  { time: "09:00–09:30", title: "開場與定調", content: "歡迎、兩天目標、菁英班定位（不是學用工具，是內化判斷力）。" },
  { time: "09:30–10:40", title: "【第一段】投資者心態解析", module: "B", content: "投資是判斷力的修煉；勢時位框架心法、逆向思維、紀律與人性。", star: "由顧及然親自講，是全課地基與定調。" },
  { time: "10:40–10:55", title: "休息", content: "" },
  { time: "10:55–11:40", title: "【分流】職務適性問卷", module: "A", content: "學員作答問卷 v2 → 當場計分 → 公布傾向。", star: "趁還沒被工具與同儕影響時測最準。" },
  { time: "11:40–12:10", title: "分組與職務指派", module: "A", content: "依問卷結果組成兩隊各五人，指派五職務（對稱編制）。" },
  { time: "12:10–13:10", title: "午休", content: "" },
  { time: "13:10–13:40", title: "【第二段】架構與規則解說（節選版）", module: "C", content: "勢時位決策鏈、團隊風控五鐵律、法律紅線（模擬操作／不代操）。只講學員該知道的規則。" },
  { time: "13:40–14:20", title: "【第三段】團隊運作手冊解說", module: "C", content: "五職務各做什麼、決策鏈如何交接、每週例會 SOP；搭配團隊運轉紀錄模板。" },
  { time: "14:20–14:35", title: "休息", content: "" },
  { time: "14:35–16:30", title: "【第五段·上】六套 skill 邏輯解說", module: "B", content: "MacroScope→InPoMa→ChartScope→PROCapital→InDay→Commander，重點講設計邏輯與鐵律來源。", star: "第一天最重的一段，是明天動手組裝的基礎。" },
  { time: "16:30–17:10", title: "【第五段·示範】示範組裝一套 edu 模板", module: "B", content: "當場示範拿一套 edu 骨架，填 TODO、加私房參數，組成可運行版本。" },
  { time: "17:10–17:30", title: "第一天總結與回家作業", content: "回顧今天、佈置作業（預讀自己職務對應的 edu 模板）。" },
];

const DAY2: Slot[] = [
  { time: "09:00–09:20", title: "第二天開場、昨日回顧", content: "今天目標：親手造出工具、並打一場團隊實戰。" },
  { time: "09:20–11:00", title: "【第五段·下】學員實際組裝自己的 skill", module: "B", content: "每位學員依職務動手組裝對應 edu 模板，填 TODO、加參數、跑通骨架。講師巡場指導。", star: "最密集的「卡點與臨場補救」記錄時機。" },
  { time: "11:00–11:15", title: "休息", content: "" },
  { time: "11:15–12:10", title: "團隊組裝整合、工具串接演練", module: "B + C", content: "五職務把工具依決策鏈串起來，演練「環境→標的→時機→配置→風控」的資訊交接。" },
  { time: "12:10–13:10", title: "午休", content: "" },
  { time: "13:10–14:40", title: "【第六段】團隊實戰：產出投資提案", module: "C + D", content: "兩隊各選一檔標的，用剛組好的工具產出完整提案（五職務各填一段，策略師整合）。" },
  { time: "14:40–14:55", title: "休息", content: "" },
  { time: "14:55–16:10", title: "【第六段·攻防】兩隊簡報與投資委員會質詢", module: "D", content: "A 隊報告、B 隊扮演投資委員會質詢，再對調。用提案範本的攻防紀錄欄記錄。" },
  { time: "16:10–16:50", title: "顧及然總講評", module: "D + E", content: "點評兩隊提案與攻防、總結兩天、把個別問題收攏成通則。" },
  { time: "16:50–17:20", title: "啟動持續運轉機制", module: "C", content: "宣布模擬投資組合正式啟動，說明課後每週例會節奏與每月績效歸因。" },
  { time: "17:20–17:30", title: "結業與合影", content: "結業、期勉、合影。" },
];

function DayTable({ title, slots }: { title: string; slots: Slot[] }) {
  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-lg font-bold text-slate-800">{title}</h2>
      <div className="space-y-3">
        {slots.map((s, i) =>
          s.content === "" ? (
            <div key={i} className="py-1 text-center text-xs text-slate-500">
              — {s.time}　{s.title} —
            </div>
          ) : (
            <div key={i} className="border-l-2 border-indigo-200 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-400">{s.time}</span>
                <span className="font-medium text-slate-800">{s.title}</span>
                {s.module && <Badge tone="indigo">模組 {s.module}</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-600">{s.content}</p>
              {s.star && (
                <p className="mt-1 text-xs text-amber-600">★ {s.star}</p>
              )}
            </div>
          ),
        )}
      </div>
    </Card>
  );
}

export default async function SchedulePage() {
  await requireInstructor();
  return (
    <div>
      <PageHeader
        title="7/18–19 兩天課程流程表"
        subtitle="孵化系統 1.0 的第一次完整運行＋記錄。第一天立心態·懂系統·學邏輯；第二天動手組裝·團隊實戰。"
      />
      <DayTable title="第一天（7/18）　立心態 · 懂系統 · 學邏輯" slots={DAY1} />
      <DayTable title="第二天（7/19）　動手組裝 · 團隊實戰" slots={DAY2} />
      <Card>
        <h3 className="mb-2 font-semibold text-slate-800">模組覆蓋</h3>
        <p className="text-sm text-slate-600">
          A 選才分工／B 能力植入／C 團隊運轉／D 成果驗收／E 過程萃取 — 五個模組在兩天內都有對應環節，且全程被記錄。
        </p>
      </Card>
    </div>
  );
}
