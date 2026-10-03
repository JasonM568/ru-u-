"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MATERIAL_CATEGORIES, teamName } from "@/lib/constants";
import type { CourseGrant, RosterMember, Video, VideoCourse } from "@/lib/video-course";
import { createCourse, createVideo, deleteCourse, deleteVideo, moveVideo, publishVideo,
  setCourseGrants, updateCourse, type GrantInput } from "./actions";

type Cohort = { code: string; display_name: string };
type Props = { courses: VideoCourse[]; videos: Video[]; grants: CourseGrant[];
  cohorts: Cohort[]; roster: RosterMember[] };
type Confirmation = "delete-course" | "move-video" | "delete-video" | "unpublish" | null;

function personLabel(person: RosterMember) {
  return `${person.display_name || person.user_id.slice(0,8)} · ${person.cohort} · ${teamName(person.team_id)}`;
}

export function VideoCourseAdmin({ courses, videos, grants, cohorts, roster }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingCourse, setEditingCourse] = useState<VideoCourse | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseNote, setCourseNote] = useState("");
  const [grantCourse, setGrantCourse] = useState<VideoCourse | null>(null);
  const [target, setTarget] = useState<GrantInput>({ cohorts: [], users: [] });
  const [personSearch, setPersonSearch] = useState("");
  const [bulkCohort, setBulkCohort] = useState("");
  const [bulkTeam, setBulkTeam] = useState("");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [previewed, setPreviewed] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirmation>(null);
  const [urlCheck, setUrlCheck] = useState("");
  const people = roster.filter((p) => p.class_role === "student");
  const filteredPeople = people.filter((p) => personLabel(p).toLowerCase().includes(personSearch.toLowerCase()));

  function editCourse(course: VideoCourse) {
    setEditingCourse(course); setCourseTitle(course.title); setCourseNote(course.note ?? "");
    setError(""); setConfirm(null);
  }
  function editGrants(course: VideoCourse) {
    const rows = grants.filter((g) => g.course_id === course.id);
    setGrantCourse(course);
    setTarget({ cohorts: rows.filter((g) => g.kind === "cohort").map((g) => g.cohort_code!).filter(Boolean),
      users: rows.filter((g) => g.kind === "user").map((g) => g.target_user_id!).filter(Boolean) });
    setPersonSearch(""); setBulkCohort(""); setBulkTeam(""); setError("");
  }
  function run(action: () => Promise<{error?:string}>, success: string, close: () => void) {
    setError("");
    start(async () => {
      const result = await action();
      if (result.error) { setError(result.error); return; }
      close(); setNotice(success); router.refresh();
    });
  }
  function addPeople() {
    if (!bulkCohort && !bulkTeam) { setError("請先選擇期別或隊伍"); return; }
    const ids = people.filter((p) => p.status === "active" &&
      (!bulkCohort || p.cohort === bulkCohort) &&
      (!bulkTeam || String(p.team_id) === bulkTeam)).map((p) => p.user_id);
    setTarget((old) => ({ ...old, users: [...new Set([...old.users,...ids])] }));
    setNotice(`已選入 ${ids.length} 位成員。此個人名單為當下快照，改期或改隊不會自動更新。`);
    setError("");
  }
  function confirmed() {
    const mode = confirm;
    setConfirm(null);
    if (mode === "delete-course" && editingCourse) {
      run(() => deleteCourse(editingCourse.id), "課程已刪除", () => setEditingCourse(null));
    } else if (mode === "move-video" && editingVideo) {
      const video = editingVideo;
      run(() => moveVideo(video.id, video.course_id, moveTarget), "影片已移動並退回草稿", () => {
        setPreviewed((old) => old.filter((id) => id !== video.id));
        setEditingVideo(null);
      });
    } else if (mode === "delete-video" && editingVideo) {
      const video = editingVideo;
      run(() => deleteVideo(video.id, video.course_id), "影片已移除", () => setEditingVideo(null));
    } else if (mode === "unpublish" && editingVideo) {
      const video = editingVideo;
      run(() => publishVideo(video.id, video.course_id, false), "影片已退回草稿", () => setEditingVideo(null));
    }
  }
  const destination = courses.find((c) => c.id === moveTarget);

  return <div className="mb-8 space-y-4">
    <details className="qec-card rounded-xl p-5">
      <summary className="cursor-pointer font-semibold text-amber-700">＋ 建立課程</summary>
      <form className="mt-4 grid gap-3" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        run(() => createCourse(new FormData(form)), "課程已建立，可設定開通對象並加入影片", () => form.reset());
      }}>
        <input name="title" required placeholder="課程名稱" className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
        <textarea name="note" placeholder="課程說明（選填）" className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
        <button disabled={busy} className="btn-gold w-fit rounded-lg px-4 py-2">建立課程</button>
      </form>
    </details>
    {courses.length > 0 && <details className="qec-card rounded-xl p-5">
      <summary className="cursor-pointer font-semibold text-amber-700">＋ 新增影片至課程</summary>
      <form className="mt-4 grid gap-3" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        run(() => createVideo(new FormData(form)), "影片已加入課程並存為草稿，請先試播再發布", () => { form.reset(); setUrlCheck(""); });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="course_id" required defaultValue="" className="rounded-lg border border-slate-300 bg-slate-50 p-2">
            <option value="" disabled>選擇課程</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select name="category" required defaultValue="day1" className="rounded-lg border border-slate-300 bg-slate-50 p-2">
            {MATERIAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        <input name="title" required placeholder="影片標題" className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
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
                : result.status === "unknown" ? "暫時無法確認影片狀態；新增後請先試播" : "影片狀態已確認；仍請先試播");
            } catch { setUrlCheck("暫時無法確認影片狀態；送出時會再檢查"); }
          }} className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
        {urlCheck && <p role="status" className="text-xs text-slate-500">{urlCheck}</p>}
        <textarea name="note" placeholder="影片說明（選填）" className="rounded-lg border border-slate-300 bg-slate-50 p-2" />
        <button disabled={busy || urlCheck.includes("私人")} className="btn-gold w-fit rounded-lg px-4 py-2">新增為草稿</button>
      </form>
    </details>}
    {error && <p role="alert" className="rounded-lg border border-rose-600 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-600 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
    {courses.length > 0 && <div className="qec-card rounded-xl p-5">
      <h2 className="font-semibold text-slate-900">課程管理</h2>
      <div className="mt-3 space-y-3">{courses.map((course) => {
        const count = videos.filter((v) => v.course_id === course.id).length;
        const grantCount = grants.filter((g) => g.course_id === course.id).length;
        return <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 p-3">
          <div><strong className="text-slate-900">{course.title}</strong>
            <p className="text-xs text-slate-500">{count} 支影片 · {grantCount} 個開通對象</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => editGrants(course)} className="btn-gold rounded-lg px-3 py-2 text-sm">課程開通</button>
            <button type="button" onClick={() => editCourse(course)} className="btn-ghost rounded-lg px-3 py-2 text-sm">編輯／刪除</button>
          </div>
        </div>;
      })}</div>
    </div>}
    {videos.length > 0 && <div className="qec-card rounded-xl p-5">
      <h2 className="font-semibold text-slate-900">影片發布管理</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{videos.map((video) => <div key={video.id}
        className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 p-3 text-sm">
        <div className="min-w-0"><strong className="block truncate text-slate-900">{video.title}</strong>
          <span className="text-xs text-slate-500">{courses.find((c) => c.id === video.course_id)?.title} · {video.published_at ? "已發布" : "草稿"}</span></div>
        <button type="button" onClick={() => { setEditingVideo(video); setMoveTarget(""); setError(""); }}
          className="btn-ghost shrink-0 rounded-lg px-3 py-2">管理</button>
      </div>)}</div>
    </div>}

    {editingCourse && <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/80 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="course-edit-title">
      <div className="qec-card mx-auto max-w-xl rounded-2xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3"><h2 id="course-edit-title" className="text-lg font-semibold">編輯課程</h2>
          <button type="button" onClick={() => setEditingCourse(null)} aria-label="關閉" className="text-2xl text-slate-400">×</button></div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">課程名稱<input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2" /></label>
          <label className="block text-sm">說明<textarea value={courseNote} onChange={(e) => setCourseNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2" /></label>
          {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setConfirm("delete-course")} className="rounded-lg border border-rose-600 px-3 py-2 text-rose-500">刪除課程</button>
            <button type="button" disabled={busy} onClick={() => run(() => updateCourse(editingCourse.id,courseTitle,courseNote),"課程已更新",() => setEditingCourse(null))}
              className="btn-gold rounded-lg px-4 py-2">儲存</button>
          </div>
        </div>
      </div>
    </div>}

    {grantCourse && <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/80 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="grants-title">
      <div className="qec-card mx-auto max-w-2xl rounded-2xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><h2 id="grants-title" className="text-lg font-semibold">課程開通：{grantCourse.title}</h2>
          <p className="text-sm text-slate-500">設定整門課的開通對象；已發布影片會立即可見。</p></div>
          <button type="button" onClick={() => setGrantCourse(null)} aria-label="關閉" className="text-2xl text-slate-400">×</button></div>
        <section className="mt-5"><h3 className="mb-2 font-semibold">期別（可複選）</h3>
          <div className="grid gap-2 sm:grid-cols-2">{cohorts.map((c) => <label key={c.code} className="flex gap-2">
            <input type="checkbox" checked={target.cohorts.includes(c.code)} onChange={() => setTarget((old) => ({ ...old,
              cohorts: old.cohorts.includes(c.code) ? old.cohorts.filter((x) => x !== c.code) : [...old.cohorts,c.code] }))} />{c.display_name}
          </label>)}</div></section>
        <section className="mt-5"><h3 className="mb-2 font-semibold">指定個人</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <select aria-label="整批選取期別" value={bulkCohort} onChange={(e) => setBulkCohort(e.target.value)} className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <option value="">全部期別</option>{cohorts.map((c) => <option key={c.code} value={c.code}>{c.display_name}</option>)}
            </select>
            <select aria-label="整批選取隊伍" value={bulkTeam} onChange={(e) => setBulkTeam(e.target.value)} className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <option value="">全部隊伍</option>{[...new Set(people.map((p) => p.team_id).filter(Boolean))].map((team) => <option key={team} value={String(team)}>{teamName(team)}</option>)}
            </select>
            <button type="button" onClick={addPeople} className="btn-ghost rounded-lg px-3 py-2">整批選入個人</button>
          </div>
          <input aria-label="搜尋成員" placeholder="搜尋姓名、期別或隊伍" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-2" />
          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-300 p-2">{filteredPeople.map((person) => <label key={person.user_id} className="flex gap-2 py-1 text-sm">
            <input type="checkbox" checked={target.users.includes(person.user_id)} onChange={() => setTarget((old) => ({ ...old,
              users: old.users.includes(person.user_id) ? old.users.filter((x) => x !== person.user_id) : [...old.users,person.user_id] }))} />
            {personLabel(person)}{person.status === "suspended" ? "（停權中）" : ""}
          </label>)}</div>
          <p className="mt-1 text-xs text-slate-500">已指定 {target.users.length} 人。整批選入是當下名單快照。</p>
        </section>
        {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setGrantCourse(null)} className="btn-ghost rounded-lg px-4 py-2">取消</button>
          <button type="button" disabled={busy} onClick={() => run(() => setCourseGrants(grantCourse.id,target),"課程開通對象已更新",() => setGrantCourse(null))}
            className="btn-gold rounded-lg px-4 py-2">儲存開通對象</button></div>
      </div>
    </div>}

    {editingVideo && <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/80 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="video-manage-title">
      <div className="qec-card mx-auto max-w-xl rounded-2xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><h2 id="video-manage-title" className="text-lg font-semibold">管理影片：{editingVideo.title}</h2>
          <p className="text-sm text-slate-500">{editingVideo.published_at ? "已發布" : "草稿"} · {courses.find((c) => c.id === editingVideo.course_id)?.title}</p></div>
          <button type="button" onClick={() => setEditingVideo(null)} aria-label="關閉" className="text-2xl text-slate-400">×</button></div>
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3"><Link href={`/videos/${editingVideo.id}`} target="_blank" rel="noopener noreferrer"
            onClick={() => setPreviewed((old) => [...new Set([...old,editingVideo.id])])} className="btn-ghost rounded-lg px-4 py-2">試播影片 ↗</Link>
            {!editingVideo.published_at && <button type="button" disabled={busy || !previewed.includes(editingVideo.id)}
              onClick={() => run(() => publishVideo(editingVideo.id,editingVideo.course_id,true),"影片已發布",() => setEditingVideo(null))}
              className="btn-gold rounded-lg px-4 py-2 disabled:opacity-50">發布影片</button>}
            {!editingVideo.published_at && !previewed.includes(editingVideo.id) && <span className="text-xs text-slate-500">請先試播，再發布。</span>}
          </div>
          <div className="border-t border-slate-300 pt-4"><label className="block text-sm">移至其他課程
            <select aria-label="移至其他課程" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2">
              <option value="">選擇目標課程</option>{courses.filter((c) => c.id !== editingVideo.course_id).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select></label>
            <button type="button" disabled={!moveTarget} onClick={() => setConfirm("move-video")}
              className="btn-ghost mt-2 rounded-lg px-4 py-2 disabled:opacity-50">移動影片</button>
          </div>
          {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-300 pt-4">
            {editingVideo.published_at && <button type="button" onClick={() => setConfirm("unpublish")} className="btn-ghost rounded-lg px-3 py-2">取消發布</button>}
            <button type="button" onClick={() => setConfirm("delete-video")} className="rounded-lg border border-rose-600 px-3 py-2 text-rose-500">移除影片</button>
          </div>
        </div>
      </div>
    </div>}

    {confirm && <ConfirmDialog title={confirm === "delete-course" ? "確認刪除課程" : confirm === "move-video" ? "確認移動影片" : confirm === "unpublish" ? "確認取消發布" : "確認移除影片"}
      onCancel={() => setConfirm(null)} confirm={<button type="button" disabled={busy} onClick={confirmed} className="btn-gold rounded-lg px-4 py-2">確認</button>}>
      {confirm === "delete-course" ? <>「{editingCourse?.title}」將被刪除。若課程內有影片，系統會拒絕刪除。</>
        : confirm === "move-video" ? <>移到「{destination?.title}」後會退回草稿，需在新課程試播並發布，學員才看得到。</>
          : confirm === "unpublish" ? <>「{editingVideo?.title}」將退回草稿，學員會立即看不到。</>
            : <>「{editingVideo?.title}」將永久移除。</>}
    </ConfirmDialog>}
  </div>;
}
