// 職務適性評估問卷 v2 — 題庫（對齊文件 01）

export type ChoiceQuestion = {
  id: string; // q1..q14
  text: string;
  options: { key: string; text: string }[];
};

export type LikertQuestion = {
  id: string; // q15..q25
  text: string;
};

// 第一部分：認知風格傾向（Q1–7，A→MA 總經 / B→MK 市場 / C→EQ 標的 / D→ST 策略）
export const PART1: ChoiceQuestion[] = [
  {
    id: "q1",
    text: "看到一則「美國通膨數據高於預期」的重大新聞，你的第一個念頭是：",
    options: [
      { key: "A", text: "它對整體經濟和利率代表什麼？" },
      { key: "B", text: "市場（大盤、匯率）會怎麼反應？" },
      { key: "C", text: "哪些公司會直接受影響？" },
      { key: "D", text: "我手上的部位該怎麼調整？" },
    ],
  },
  {
    id: "q2",
    text: "拿到一家公司的財報，你最想先看：",
    options: [
      { key: "A", text: "整體產業景氣和它所處的大環境" },
      { key: "B", text: "市場和法人對這財報的反應與籌碼變化" },
      { key: "C", text: "營收、毛利、現金流這些基本面細節" },
      { key: "D", text: "這對我的投資組合配置有何意義" },
    ],
  },
  {
    id: "q3",
    text: "朋友問你「現在能不能進場」，你的回答最可能從哪裡切入：",
    options: [
      { key: "A", text: "先看現在大環境是順風還逆風" },
      { key: "B", text: "先看盤面氣氛、量能和籌碼" },
      { key: "C", text: "先看你想買的那家公司值不值得" },
      { key: "D", text: "先看你整體部位的配置和風險" },
    ],
  },
  {
    id: "q4",
    text: "你比較享受哪一種「研究的快感」：",
    options: [
      { key: "A", text: "從一堆總經數據裡拼出大局的輪廓" },
      { key: "B", text: "從盤面變化和資金流向中讀出市場心理" },
      { key: "C", text: "深入鑽研一家公司，挖出別人沒看到的價值" },
      { key: "D", text: "把零散的資訊整合成一個清晰的決策" },
    ],
  },
  {
    id: "q5",
    text: "一份投資報告，你認為最關鍵、最不能出錯的是：",
    options: [
      { key: "A", text: "對宏觀環境與政策方向的判斷" },
      { key: "B", text: "對市場時機與資金動向的掌握" },
      { key: "C", text: "對個股價值與風險的評估" },
      { key: "D", text: "最終配置與資金分配的決定" },
    ],
  },
  {
    id: "q6",
    text: "如果用一個比喻形容你想扮演的角色，你最像：",
    options: [
      { key: "A", text: "氣象預報員——預判整體天候" },
      { key: "B", text: "航海觀測員——盯洋流與風向變化" },
      { key: "C", text: "珠寶鑑定師——鑑別單一標的的真價值" },
      { key: "D", text: "船長——綜合所有資訊決定航向" },
    ],
  },
  {
    id: "q7",
    text: "團隊開會時，你最常出現的發言是：",
    options: [
      { key: "A", text: "「我們得先搞清楚現在大環境站在哪一邊」" },
      { key: "B", text: "「市場現在的反應和籌碼透露了什麼」" },
      { key: "C", text: "「這家公司的基本面到底撐不撐得起來」" },
      { key: "D", text: "「綜合大家說的，我建議這樣配置」" },
    ],
  },
];

// 第二部分：風險與決斷傾向（Q8–14，A→分析反思 / B→果斷執行）
export const PART2: ChoiceQuestion[] = [
  {
    id: "q8",
    text: "當你的分析判斷和市場實際走勢相反時，你傾向：",
    options: [
      { key: "A", text: "先停下來，重新檢查我的分析哪裡可能錯了" },
      { key: "B", text: "相信當下的盤面訊號，先順應市場再說" },
    ],
  },
  {
    id: "q9",
    text: "面對一筆正在虧損的部位，你的本能反應是：",
    options: [
      { key: "A", text: "回頭重新檢視當初的買進理由還成不成立" },
      { key: "B", text: "先依預設紀律處理（停損或加碼），事後再檢討" },
    ],
  },
  {
    id: "q10",
    text: "你對「按計畫執行」和「臨場應變」的偏好：",
    options: [
      { key: "A", text: "我喜歡事前想清楚、把規則訂好，照規則走最安心" },
      { key: "B", text: "計畫趕不上變化，我擅長在當下快速判斷與行動" },
    ],
  },
  {
    id: "q11",
    text: "做決定時，你比較怕的是：",
    options: [
      { key: "A", text: "怕考慮不周、漏掉重要風險" },
      { key: "B", text: "怕猶豫太久、錯過行動時機" },
    ],
  },
  {
    id: "q12",
    text: "一個還沒完全想清楚但機會稍縱即逝的投資，你會：",
    options: [
      { key: "A", text: "寧可錯過，也要先確認風險再進場" },
      { key: "B", text: "先小量進場卡位，邊走邊修正" },
    ],
  },
  {
    id: "q13",
    text: "別人形容你做事，比較可能說你：",
    options: [
      { key: "A", text: "細心、嚴謹、不輕易出手" },
      { key: "B", text: "果斷、敢衝、行動力強" },
    ],
  },
  {
    id: "q14",
    text: "盤中價格劇烈波動時，你的狀態通常是：",
    options: [
      { key: "A", text: "需要時間沉澱思考，不喜歡被逼著立刻決定" },
      { key: "B", text: "反而更專注、更能在壓力下快速反應" },
    ],
  },
];

// 第三部分：協作角色傾向（Q15–25，Likert 1–5）
// LD 主導整合：15,18,21,24 / IN 獨立鑽研：16,19,22 / GK 流程把關：17,20,23,25
export const PART3: LikertQuestion[] = [
  { id: "q15", text: "在團隊裡，我常自然而然扮演「把大家意見收攏起來下結論」的人。" },
  { id: "q16", text: "我享受長時間獨自鑽研一個主題，不太需要他人互動也能投入。" },
  { id: "q17", text: "我對流程、紀律、記錄這類事情特別在意，看到亂七八糟會想整理。" },
  { id: "q18", text: "我擅長在資訊不完整時做出取捨和決定，並為決定負責。" },
  { id: "q19", text: "我寧可把一件事鑽到很深很透，也不想同時管很多事。" },
  { id: "q20", text: "我常常是那個提醒大家「我們是不是漏了什麼風險」的人。" },
  { id: "q21", text: "我喜歡綜觀全局，把不同領域的資訊串成一個完整的判斷。" },
  { id: "q22", text: "比起做決定，我更喜歡提供深入的分析讓別人去做決定。" },
  { id: "q23", text: "我對數字、紀錄、對帳的準確性有近乎龜毛的要求。" },
  { id: "q24", text: "在意見分歧時，我傾向站出來協調並推動團隊達成共識。" },
  { id: "q25", text: "我能客觀指出包括自己在內的決策錯誤，不怕說出不中聽的事實。" },
];

export const LIKERT_LABELS = [
  { value: 1, label: "非常不像我" },
  { value: 2, label: "有點不像" },
  { value: 3, label: "普通" },
  { value: 4, label: "有點像我" },
  { value: 5, label: "非常像我" },
];

export const EXPERIENCE_OPTIONS = ["無", "1 年內", "1–3 年", "3 年以上"];
export const AI_COURSE_OPTIONS = ["已上初階", "已上進階", "兩者皆已完成"];

export const ALL_CHOICE_IDS = [...PART1, ...PART2].map((q) => q.id);
export const ALL_LIKERT_IDS = PART3.map((q) => q.id);
