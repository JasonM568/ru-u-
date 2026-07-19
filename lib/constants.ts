export type JobRole = "macro" | "equity" | "market" | "pm" | "risk";

export const JOB_ROLES: {
  key: JobRole;
  name: string;
  tag: string;
  frame: string;
  skill: string;
  oneLiner: string;
}[] = [
  {
    key: "macro",
    name: "總經分析師",
    tag: "Macro",
    frame: "勢",
    skill: "MacroScope",
    oneLiner: "看大環境：利率、通膨、油價、政策、地緣，判斷風往哪吹",
  },
  {
    key: "equity",
    name: "標的分析師",
    tag: "Equity",
    frame: "時",
    skill: "InPoMa",
    oneLiner: "看個股：基本面、財報、估值、產業地位",
  },
  {
    key: "market",
    name: "市場與操盤",
    tag: "Market & Trade",
    frame: "時＋位",
    skill: "InPoMa / InDay / ChartScope",
    oneLiner: "看盤面＋管執行：技術、籌碼、情緒、進出場時機、停損停利",
  },
  {
    key: "pm",
    name: "投資策略師",
    tag: "PM",
    frame: "位",
    skill: "PROCapital",
    oneLiner: "做整合：彙整前三者，決定買什麼、買多少、如何配置",
  },
  {
    key: "risk",
    name: "風控與紀錄長",
    tag: "Risk",
    frame: "貫穿",
    skill: "PROCapital ＋ 台帳",
    oneLiner: "守紀律：檢核風險上限、記錄決策理由與績效歸因",
  },
];

export const JOB_ROLE_MAP: Record<JobRole, (typeof JOB_ROLES)[number]> =
  Object.fromEntries(JOB_ROLES.map((r) => [r.key, r])) as Record<
    JobRole,
    (typeof JOB_ROLES)[number]
  >;

export function jobRoleName(key?: string | null): string {
  if (!key) return "未指派";
  return JOB_ROLE_MAP[key as JobRole]?.name ?? key;
}

export const TEAMS = [
  { id: 1, name: "第一隊" },
  { id: 2, name: "第二隊" },
];

export function teamName(id?: number | null): string {
  if (!id) return "未分隊";
  return TEAMS.find((t) => t.id === id)?.name ?? `第 ${id} 隊`;
}

// ── 課程教材 ──

export const MATERIAL_CATEGORIES = [
  { key: "pre", name: "課前資料" },
  { key: "day1", name: "Day 1" },
  { key: "day2", name: "Day 2" },
  { key: "extra", name: "補充教材" },
] as const;

export function materialCategoryName(key?: string | null): string {
  if (!key) return "其他";
  return MATERIAL_CATEGORIES.find((c) => c.key === key)?.name ?? "其他";
}

export const MATERIALS_BUCKET = "elite-materials";
export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024;

/** 允許的副檔名 → MIME。storage path 的 ext 與 bucket allowed_mime_types 都以此為準。 */
export const MATERIAL_EXT_MIME: Record<string, string> = {
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export const MATERIAL_ACCEPT = Object.keys(MATERIAL_EXT_MIME)
  .map((e) => `.${e}`)
  .join(",");
