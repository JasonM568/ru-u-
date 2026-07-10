import { computeScores } from "../lib/scoring";
import type { Answers } from "../lib/scoring";

function build(p1: string, p2: string, p3: Record<string, number>): Answers {
  const a: Answers = {};
  for (let i = 1; i <= 7; i++) a[`q${i}`] = p1;
  for (let i = 8; i <= 14; i++) a[`q${i}`] = p2;
  for (let i = 15; i <= 25; i++) a[`q${i}`] = 3;
  return { ...a, ...p3 };
}

const cases: { name: string; answers: Answers; expect: string }[] = [
  {
    name: "全 A（總經）＋分析型＋鑽研高 → macro",
    answers: build("A", "A", { q16: 5, q19: 5, q22: 5 }),
    expect: "macro",
  },
  {
    name: "全 B（市場）＋執行型 → market",
    answers: build("B", "B", {}),
    expect: "market",
  },
  {
    name: "全 C（標的）＋分析型＋鑽研高 → equity",
    answers: build("C", "A", { q16: 5, q19: 5, q22: 5 }),
    expect: "equity",
  },
  {
    name: "全 D（策略）＋主導高 → pm",
    answers: build("D", "B", { q15: 5, q18: 5, q21: 5, q24: 5 }),
    expect: "pm",
  },
  {
    name: "把關 GK 全滿＋分析型（part1 分散）→ risk",
    answers: {
      // part1 分散：無明顯主傾向（MA2/MK2/EQ2/ST1）
      q1: "A", q2: "B", q3: "C", q4: "D", q5: "A", q6: "B", q7: "C",
      // part2 分析型
      q8: "A", q9: "A", q10: "A", q11: "A", q12: "A", q13: "A", q14: "A",
      // part3：GK 全滿、其餘普通
      q15: 3, q16: 3, q17: 5, q18: 3, q19: 3, q20: 5, q21: 3, q22: 3, q23: 5, q24: 3, q25: 5,
    },
    expect: "risk",
  },
];

let pass = 0;
for (const c of cases) {
  const s = computeScores(c.answers);
  const ok = s.suggestedRole === c.expect;
  if (ok) pass++;
  console.log(
    `${ok ? "✓" : "✗"} ${c.name}\n   → ${s.suggestedRole} (期望 ${c.expect})  fit=${JSON.stringify(
      Object.fromEntries(
        Object.entries(s.fit).map(([k, v]) => [k, Number(v.toFixed(1))]),
      ),
    )}`,
  );
}
console.log(`\n${pass}/${cases.length} passed`);
if (pass !== cases.length) process.exit(1);
