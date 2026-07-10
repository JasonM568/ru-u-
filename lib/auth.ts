import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { JobRole } from "@/lib/constants";

export type Enrollment = {
  user_id: string;
  class_role: "student" | "instructor";
  job_role: JobRole | null;
  team_id: number | null;
  display_name: string | null;
  cohort: string;
};

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  enrollment: Enrollment | null;
};

export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollment } = await supabase
    .schema("elite")
    .from("enrollments")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    enrollment: (enrollment as Enrollment | null) ?? null,
  };
}

/** Requires a logged-in user who is enrolled in the cohort (student or instructor). */
export async function requireEnrollment(): Promise<
  SessionContext & { enrollment: Enrollment }
> {
  const ctx = await getSessionContext();
  if (!ctx.enrollment) redirect("/not-enrolled");
  return ctx as SessionContext & { enrollment: Enrollment };
}

/** Requires an instructor. Non-instructors are bounced to the dashboard. */
export async function requireInstructor(): Promise<
  SessionContext & { enrollment: Enrollment }
> {
  const ctx = await requireEnrollment();
  if (ctx.enrollment.class_role !== "instructor") redirect("/");
  return ctx;
}
