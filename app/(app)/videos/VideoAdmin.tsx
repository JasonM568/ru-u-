"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MATERIAL_CATEGORIES, teamName } from "@/lib/constants";
import type { RosterMember, Video, VideoAudience } from "@/lib/video-course";
import { applyCategoryAudiences, createVideo, deleteVideo, saveVideoAudiences, type AudienceInput } from "./actions";

type Cohort = { code: string; display_name: string };
type Props = { videos: Video[]; audiences: VideoAudience[]; cohorts: Cohort[]; roster: RosterMember[] };

function currentAudience(id: string, all: VideoAudience[]): AudienceInput {
  const rows = all.filter((a) => a.video_id === id);
  return {
    all: rows.some((a) => a.kind === "all"),
    cohorts: rows.filter((a) => a.kind === "cohort").map((a) => a.cohort_code!).filter(Boolean),
    users: rows.filter((a) => a.kind === "user").map((a) => a.target_user_id!).filter(Boolean),
  };
}

function personLabel(person: RosterMember) {
  return `${person.display_name || person.user_id.slice(0,8)} · ${person.cohort} · ${teamName(person.team_id)}`;
}

export function VideoAdmin({ videos, audiences, cohorts, roster }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Video | null>(null);
  const [target, setTarget] = useState<AudienceInput>({ cohorts: [], all: false, users: [] });
  const [confirm, setConfirm] = useState<"category" | "unpublish" | "delete" | null>(null);
  const [personSearch, setPersonSearch] = useState("");
  const [bulkCohort, setBulkCohort] = useState("");
  const [bulkTeam, setBulkTeam] = useState("");
  const [urlCheck, setUrlCheck] = useState("");

  const categoryVideos = useMemo(() => editing
    ? videos.filter((v) => v.category === editing.category) : [], [editing, videos]);
  const people = roster.filter((p) => p.class_role === "student");
  const filteredPeople = people.filter((p) => personLabel(p).toLowerCase().includes(personSearch.toLowerCase()));

  function open(video: Video) {
    setEditing(video);
    setTarget(currentAudience(video.id, audiences));
    setError(""); setConfirm(null); setPersonSearch("");
  }
  function toggleUser(id: string) {
    setTarget((old) => ({ ...old, users: old.users.includes(id)
      ? old.users.filter((x) => x !== id) : [...old.users,id] }));
  }
  function toggleCohort(code: string) {
    setTarget((old) => ({ ...old, all: false, cohorts: old.cohorts.includes(code)
      ? old.cohorts.filter((x) => x !== code) : [...old.cohorts,code] }));
  }
  function copyPrevious() {
    if (!editing) return;
    const before = [...videos].filter((v) => v.created_at < editing.created_at ||
      (v.created_at === editing.created_at && v.id < editing.id))
      .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
    if (!before) { setError("這是第一支影片，沒有上一支的對象可沿用"); return; }
    setTarget(currentAudience(before.id, audiences)); setError("");
  }
  function addPeople() {
    const ids = people.filter((p) => (!bulkCohort || p.cohort === bulkCohort) &&
      (!bulkTeam || String(p.team_id) === bulkTeam)).map((p) => p.user_id);
    if (!bulkCohort && !bulkTeam) { setError("請先選擇期別或隊伍"); return; }
    setTarget((old) => ({ ...old, users: [...new Set([...old.users,...ids])] }));
    setNotice(`已選入 ${ids.length} 位成員。此名單是快照，改期或改隊後不會自動變動。`);
  }
  function save() {
    if (!editing) return;
    start(async () => {
      const result = await saveVideoAudiences(editing.id,target,true);
      if (result.error) { setError(result.error); return; }
      setEditing(null); setNotice("影片開通對象已更新"); router.refresh();
    });
  }
  function confirmed() {
    if (!editing || !confirm) return;
    const mode = confirm;
    setConfirm(null);
    start(async () => {
      const result = mode === "category"
        ? await applyCategoryAudiences(editing.id,target)
        : mode === "unpublish"
          ? await saveVideoAudiences(editing.id,{ all:false,cohorts:[],users:[] },false)
          : await deleteVideo(editing.id);
      if (result.error) { setError(result.error); return; }
      setEditing(null); setNotice(mode === "category" ? `已覆寫同分類 ${categoryVideos.length} 支影片的對象`
        : mode === "unpublish" ? "影片已取消開通，退回草稿" : "影片已移除");
      router.refresh();
    });
  }

  return <div className="mb-6 space-y-4">
    <details className="qec-card rounded-xl p-5">
      <summary className="cursor-pointer font-semibold text-[color:var(--gold-bright)]">＋ 新增課程影片</summary>
      <form className="mt-4 grid gap-3" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        start(async () => {
          const result = await createVideo(data);
          if (result.error) { setError(result.error); return; }
          form.reset(); setError(""); setNotice("影片已儲存為草稿，請先試播再開通"); router.refresh();
        });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="title" required placeholder="影片標題" className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
          <select name="category" required defaultValue="extra" className="rounded-lg border border-slate-300 bg-slate-50 p-2">
            {MATERIAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        <input name="url" type="url" required placeholder="YouTube 或 Vimeo 網址"
          onChange={() => setUrlCheck("")}
          onBlur={async (event) => {
            const input = event.currentTarget;
            const value = input.value.trim();
            if (!value) return;
            setUrlCheck("影片狀態檢查中…");
            try {
              const response = await fetch(`/api/videos/check?url=${encodeURIComponent(value)}`);
              const result = await response.json();
              if (input.value.trim() !== value) return;
              setUrlCheck(result.status === "private" ? "私人影片無法新增，請改成「不公開」"
                : result.status === "processing" ? "影片可能仍在轉檔；新增後請先試播" : "影片狀態已確認");
            } catch { setUrlCheck("暫時無法確認影片狀態，送出時會再檢查"); }
          }}
          className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
        {urlCheck && <p role="status" className={`text-xs ${urlCheck.includes("私人") ? "text-rose-600" : "text-slate-400"}`}>{urlCheck}</p>}
        <textarea name="note" placeholder="說明（選填）" className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
        <button disabled={busy || urlCheck.includes("私人")} className="btn-gold w-fit rounded-lg px-4 py-2 font-semibold">{busy ? "檢查中…" : "新增為草稿"}</button>
        <p className="text-xs text-slate-400">送出時會檢查 YouTube 私人影片；對象在開通時選擇。</p>
      </form>
    </details>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">{notice}</p>}
    {videos.length > 0 && <div className="qec-card rounded-xl p-4">
      <h2 className="font-semibold">影片開通管理</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {videos.map((v) => <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 p-3 text-sm">
          <span className="min-w-0 truncate">{v.title} <span className={v.published_at ? "text-emerald-600" : "text-amber-600"}>· {v.published_at ? "已開通" : "草稿"}</span></span>
          <button type="button" onClick={() => open(v)} className="btn-ghost shrink-0 rounded-md px-3 py-1">{v.published_at ? "管理對象" : "開通"}</button>
        </div>)}
      </div>
    </div>}

    {editing && <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/80 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="audience-title">
      <div className="qec-card mx-auto max-w-2xl rounded-2xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="audience-title" className="text-lg font-semibold">開通對象：{editing.title}</h2>
            <p className="text-sm text-slate-400">儲存後立即生效。指定個人可與期別並存。</p></div>
          <button type="button" onClick={() => setEditing(null)} aria-label="關閉" className="text-2xl text-slate-400">×</button>
        </div>
        <div className="mt-5 space-y-5">
          <section><h3 className="mb-2 font-semibold">期別</h3>
            <label className="mb-2 flex gap-2"><input type="checkbox" checked={target.all} onChange={(e) => setTarget((old) => ({...old,all:e.target.checked,cohorts:e.target.checked?[]:old.cohorts}))} />所有期別（含未來新期別）</label>
            <div className="grid gap-2 sm:grid-cols-2">{cohorts.map((c) => <label key={c.code} className="flex gap-2"><input type="checkbox" disabled={target.all} checked={target.cohorts.includes(c.code)} onChange={() => toggleCohort(c.code)} />{c.display_name}</label>)}</div>
          </section>
          <section><h3 className="mb-2 font-semibold">指定個人</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <select aria-label="整批選取期別" value={bulkCohort} onChange={(e) => setBulkCohort(e.target.value)} className="rounded-lg border border-slate-300 bg-slate-50 p-2"><option value="">全部期別</option>{cohorts.map((c) => <option key={c.code} value={c.code}>{c.display_name}</option>)}</select>
              <select aria-label="整批選取隊伍" value={bulkTeam} onChange={(e) => setBulkTeam(e.target.value)} className="rounded-lg border border-slate-300 bg-slate-50 p-2"><option value="">全部隊伍</option>{[...new Set(people.map((p) => p.team_id).filter(Boolean))].map((team) => <option key={team} value={String(team)}>{teamName(team)}</option>)}</select>
              <button type="button" onClick={addPeople} className="btn-ghost rounded-lg px-3 py-2">整批選入個人</button>
            </div>
            <input aria-label="搜尋成員" placeholder="搜尋姓名、期別或隊伍" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-2" />
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-300 p-2">{filteredPeople.map((p) => <label key={p.user_id} className="flex gap-2 py-1 text-sm"><input type="checkbox" checked={target.users.includes(p.user_id)} onChange={() => toggleUser(p.user_id)} />{personLabel(p)}{p.status === "suspended" ? "（停權中）" : ""}</label>)}</div>
            <p className="mt-1 text-xs text-slate-400">已選 {target.users.length} 人。整批選入是當下名單快照。</p>
          </section>
          <div className="flex flex-wrap gap-2 border-t border-slate-300 pt-4">
            <button type="button" onClick={copyPrevious} className="btn-ghost rounded-lg px-3 py-2">沿用上一支影片對象</button>
            <button type="button" onClick={() => setConfirm("category")} className="btn-ghost rounded-lg px-3 py-2">套用到同分類所有影片</button>
          </div>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {editing.published_at && <button type="button" onClick={() => setConfirm("unpublish")} className="rounded-lg border border-amber-700 px-3 py-2 text-amber-700">取消開通</button>}
            <button type="button" onClick={() => setConfirm("delete")} className="rounded-lg border border-rose-700 px-3 py-2 text-rose-600">移除影片</button>
            <button type="button" disabled={busy} onClick={save} className="btn-gold rounded-lg px-4 py-2 font-semibold">{busy ? "儲存中…" : "儲存並開通"}</button>
          </div>
        </div>
      </div>
    </div>}
    {editing && confirm && <ConfirmDialog title={confirm === "category" ? "確認覆寫同分類對象" : confirm === "unpublish" ? "確認取消開通" : "確認移除影片"}
      onCancel={() => setConfirm(null)} confirm={<button type="button" disabled={busy} onClick={confirmed} className="btn-gold rounded-lg px-4 py-2">確認</button>}>
      {confirm === "category" ? <>以下 {categoryVideos.length} 支影片將改用目前選定對象：{categoryVideos.map((v) => v.title).join("、")}。其他分類不受影響。</>
        : confirm === "unpublish" ? <>「{editing.title}」將退回草稿，學員會立即看不到。</>
        : <>「{editing.title}」及其開通資料將永久移除。</>}
    </ConfirmDialog>}
  </div>;
}
