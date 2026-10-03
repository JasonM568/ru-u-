import { MATERIAL_CATEGORIES } from "@/lib/constants";

export type Video = {
  id: string; course_id: string; title: string; url: string; category: string; note: string | null;
  created_at: string; published_at: string | null;
};
export type VideoCourse = {
  id: string; title: string; note: string | null; created_at: string;
};
export type CourseGrant = {
  course_id: string; kind: "cohort" | "user";
  cohort_code: string | null; target_user_id: string | null;
};
export type RosterMember = {
  user_id: string; display_name: string | null; cohort: string;
  team_id: number | null; class_role: string; status: string;
};

export function orderedVideos(videos: Video[]): Video[] {
  const order = MATERIAL_CATEGORIES.map((c) => c.key as string);
  return [...videos].sort((a,b) => {
    const ai = order.indexOf(a.category), bi = order.indexOf(b.category);
    const category = (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    return category || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
}

export function categoryName(key: string): string {
  return MATERIAL_CATEGORIES.find((c) => c.key === key)?.name ?? "其他";
}

export function videoGroups(videos: Video[]) {
  const sorted = orderedVideos(videos);
  const keys = [...MATERIAL_CATEGORIES.map((c) => c.key as string), "other"];
  return keys.map((key) => ({
    key, name: key === "other" ? "其他" : categoryName(key),
    videos: sorted.filter((v) => key === "other"
      ? !MATERIAL_CATEGORIES.some((c) => c.key === v.category)
      : v.category === key),
  })).filter((g) => g.videos.length);
}
