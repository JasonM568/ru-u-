"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishVideo } from "../actions";

export function PublishButton({ id, courseId, published }: { id: string; courseId: string; published: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    setError("");
    start(async () => {
      const result = await publishVideo(id, courseId, !published);
      if (result.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  return <div className="mt-3 flex items-center gap-3">
    <button type="button" disabled={busy} onClick={toggle}
      className={`rounded-lg px-4 py-2 text-sm disabled:opacity-50 ${published ? "btn-ghost" : "btn-gold"}`}>
      {published ? "取消發布" : "發布影片"}
    </button>
    {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
  </div>;
}
