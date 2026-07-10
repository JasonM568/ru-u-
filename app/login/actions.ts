"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent("請輸入帳號與密碼")}&next=${encodeURIComponent(next)}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent("登入失敗：帳號或密碼有誤")}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next.startsWith("/") ? next : "/");
}
