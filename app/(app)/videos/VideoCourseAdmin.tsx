"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MATERIAL_CATEGORIES, teamName } from "@/lib/constants";
import { orderedVideos, videoGroups, type CourseGrant, type RosterMember, type Video, type VideoCourse } from "@/lib/video-course";
import { createCourse, createVideo, deleteCourse, deleteVideo, markPreviewed, moveVideo, publishAllDrafts,
  publishVideo, reorderCourseVideos, setCourseGrants, updateCourse, updateVideo, type GrantInput } from "./actions";

type Cohort = { code: string; display_name: string };
type Props = { courses: VideoCourse[]; videos: Video[]; grants: CourseGrant[];
  cohorts: Cohort[]; roster: RosterMember[] };
type Confirmation = "delete-course" | "move-video" | "delete-video" | "unpublish" | "publish-all" | null;

function personLabel(person: RosterMember) {
  return `${person.display_name || person.user_id.slice(0,8)} · ${person.cohort} · ${teamName(person.team_id)}`;
}

export function VideoCourseAdmin({ courses, videos, grants, cohorts, roster }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingCourse, setEditingCourse] = useState<VideoCourse | null>(null);
  const [bulkPublishCourse, setBulkPublishCourse] = useState<VideoCourse | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseNote, setCourseNote] = useState("");
  const [grantCourse, setGrantCourse] = useState<VideoCourse | null>(null);
  const [target, setTarget] = useState<GrantInput>({ cohorts: [], users: [] });
  const [personSearch, setPersonSearch] = useState("");
  const [bulkCohort, setBulkCohort] = useState("");
  const [bulkTeam, setBulkTeam] = useState("");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoNote, setVideoNote] = useState("");
  const [localVideos, setLocalVideos] = useState(videos);
  const [sourceVideos, setSourceVideos] = useState(videos);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const drag = useRef<{ id: string; courseId: string; category: string; targetId: string | null } | null>(null);
  const reorderInFlight = useRef(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [previewed, setPreviewed] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirmation>(null);
  const [urlCheck, setUrlCheck] = useState("");
  const people = roster.filter((p) => p.class_role === "student");
  const filteredPeople = people.filter((p) => personLabel(p).toLowerCase().includes(personSearch.toLowerCase()));

  if (videos !== sourceVideos) {
    setSourceVideos(videos);
    setLocalVideos(videos);
  }

  function editVideo(video: Video) {
    setEditingVideo(video); setVideoTitle(video.title); setVideoNote(video.note ?? "");
    setMoveTarget(""); setError("");
  }

  function reorderWithinCategory(id: string, targetId: string) {
    if (busy || reorderInFlight.current || id === targetId) return;
    const moving = localVideos.find((v) => v.id === id);
    const target = localVideos.find((v) => v.id === targetId);
    if (!moving || !target || moving.course_id !== target.course_id || moving.category !== target.category) return;
    const courseVideos = orderedVideos(localVideos.filter((v) => v.course_id === moving.course_id));
    const from = courseVideos.findIndex((v) => v.id === id);
    const to = courseVideos.findIndex((v) => v.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = courseVideos.splice(from,1);
    courseVideos.splice(to,0,item);
    const ranked = new Map(courseVideos.map((v,index) => [v.id,index]));
    const previous = localVideos;
    const next = localVideos.map((v) => ranked.has(v.id) ? { ...v, sort_order: ranked.get(v.id)! } : v);
    setLocalVideos(next);
    setError("");
    reorderInFlight.current = true;
    start(async () => {
      try {
        const result = await reorderCourseVideos(moving.course_id,courseVideos.map((v) => v.id));
        if (result.error) { setLocalVideos(previous); setError(result.error); return; }
        setNotice("影片順序已儲存"); router.refresh();
      } catch {
        setLocalVideos(previous); setError("排序儲存失敗，請稍後重試");
      } finally {
        reorderInFlight.current = false;
      }
    });
  }

  function onDragStart(event: PointerEvent<HTMLButtonElement>, video: Video) {
    if (busy || reorderInFlight.current) return;
    drag.current = { id: video.id, courseId: video.course_id, category: video.category, targetId: null };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedId(video.id); setDropId(null);
  }

  function onDragMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const row = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-sort-video-id]");
    const target = localVideos.find((v) => v.id === row?.dataset.sortVideoId);
    const valid = target && target.course_id === drag.current.courseId && target.category === drag.current.category;
    const targetId = valid ? target.id : null;
    drag.current.targetId = targetId;
    setDropId(targetId);
  }

  function onDragEnd() {
    const current = drag.current;
    drag.current = null; setDraggedId(null); setDropId(null);
    if (current?.targetId) reorderWithinCategory(current.id,current.targetId);
  }

  function onDragCancel() {
    drag.current = null; setDraggedId(null); setDropId(null);
  }

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
    } else if (mode === "publish-all" && bulkPublishCourse) {
      const course = bulkPublishCourse;
      setError("");
      start(async () => {
        const result = await publishAllDrafts(course.id);
        if (result.error) { setError(result.error); return; }
        setBulkPublishCourse(null); setNotice(`已發布 ${result.count ?? 0} 支影片`); router.refresh();
      });
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
        const draftCount = videos.filter((v) => v.course_id === course.id && !v.published_at).length;
        return <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 p-3">
          <div><strong className="text-slate-900">{course.title}</strong>
            <p className="text-xs text-slate-500">{count} 支影片 · {grantCount} 個開通對象{draftCount > 0 ? ` · ${draftCount} 支草稿` : ""}</p></div>
          <div className="flex flex-wrap gap-2">
            {draftCount > 0 && <button type="button" onClick={() => { setBulkPublishCourse(course); setConfirm("publish-all"); }}
              className="btn-gold rounded-lg px-3 py-2 text-sm">全部發布（{draftCount}）</button>}
            <button type="button" onClick={() => editGrants(course)} className="btn-gold rounded-lg px-3 py-2 text-sm">課程開通</button>
            <button type="button" onClick={() => editCourse(course)} className="btn-ghost rounded-lg px-3 py-2 text-sm">編輯／刪除</button>
          </div>
        </div>;
      })}</div>
    </div>}
    {localVideos.length > 0 && <div className="qec-card rounded-xl p-5">
      <h2 className="font-semibold text-slate-900">影片發布管理</h2>
      <p className="mt-1 text-xs text-slate-500">拖曳把手可調整同一分類內的觀看順序；觸控或鍵盤也可使用上下按鈕。</p>
      <div className="mt-4 space-y-5">{courses.map((course) => {
        const courseVideos = localVideos.filter((v) => v.course_id === course.id);
        if (!courseVideos.length) return null;
        return <section key={course.id} aria-label={course.title} className="space-y-4">
          <h3 className="border-b border-slate-300 pb-2 font-semibold text-slate-900">{course.title}</h3>
          {videoGroups(courseVideos).map((group) => <div key={group.key} className="space-y-2">
            <h4 className="text-sm font-semibold text-amber-700">{group.name}</h4>
            {group.videos.map((video,index) => <div key={video.id} data-sort-video-id={video.id}
              className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${dropId === video.id && draggedId !== video.id ? "border-amber-700 bg-amber-50" : "border-slate-300"} ${draggedId === video.id ? "opacity-60" : ""}`}>
              <button type="button" aria-label={`拖曳排序：${video.title}`} title="拖曳排序" disabled={busy}
                onPointerDown={(event) => onDragStart(event,video)} onPointerMove={onDragMove}
                onPointerUp={onDragEnd} onPointerCancel={onDragCancel}
                className="shrink-0 cursor-grab rounded-lg px-2 py-2 text-lg text-slate-600 active:cursor-grabbing disabled:opacity-40"
                style={{ touchAction: "none" }}>☰</button>
              <div className="min-w-0 flex-1"><strong className="block truncate text-slate-900">{video.title}</strong>
                <span className="text-xs text-slate-500">{video.published_at ? "已發布" : "草稿"}</span></div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" aria-label={`上移：${video.title}`} disabled={busy || index === 0}
                  onClick={() => reorderWithinCategory(video.id,group.videos[index-1].id)}
                  className="btn-ghost rounded-lg px-2 py-2 disabled:opacity-30">↑</button>
                <button type="button" aria-label={`下移：${video.title}`} disabled={busy || index === group.videos.length-1}
                  onClick={() => reorderWithinCategory(video.id,group.videos[index+1].id)}
                  className="btn-ghost rounded-lg px-2 py-2 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => editVideo(video)} className="btn-ghost rounded-lg px-3 py-2">管理</button>
              </div>
            </div>)}</div>)}
        </section>;
      })}</div>
      {error && !editingVideo && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
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
          <div className="space-y-3">
            <label className="block text-sm">影片標題<input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2" /></label>
            <label className="block text-sm">影片說明<textarea value={videoNote} onChange={(event) => setVideoNote(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2" /></label>
            <button type="button" disabled={busy || !videoTitle.trim()}
              onClick={() => run(() => updateVideo(editingVideo.id,editingVideo.course_id,videoTitle,videoNote),
                "影片資料已更新",() => setEditingVideo(null))}
              className="btn-gold rounded-lg px-4 py-2 disabled:opacity-50">儲存影片資料</button>
          </div>
          <div className="flex flex-wrap items-center gap-3"><Link href={`/videos/${editingVideo.id}`} target="_blank" rel="noopener noreferrer"
            onClick={() => {
              setPreviewed((old) => [...new Set([...old,editingVideo.id])]);
              markPreviewed(editingVideo.id);
            }} className="btn-ghost rounded-lg px-4 py-2">試播影片 ↗</Link>
            {!editingVideo.published_at && <button type="button"
              disabled={busy || !(previewed.includes(editingVideo.id) || editingVideo.previewed_at)}
              onClick={() => run(() => publishVideo(editingVideo.id,editingVideo.course_id,true),"影片已發布",() => setEditingVideo(null))}
              className="btn-gold rounded-lg px-4 py-2 disabled:opacity-50">發布影片</button>}
            {!editingVideo.published_at && !(previewed.includes(editingVideo.id) || editingVideo.previewed_at) &&
              <span className="text-xs text-slate-500">請先試播，再發布：試播影片會開新分頁播放，播放後回到這裡再按發布。</span>}
            {!editingVideo.published_at && !previewed.includes(editingVideo.id) && editingVideo.previewed_at &&
              <span className="text-xs text-slate-500">之前已試播過，可直接發布。</span>}
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

    {confirm && <ConfirmDialog title={confirm === "delete-course" ? "確認刪除課程" : confirm === "move-video" ? "確認移動影片" : confirm === "unpublish" ? "確認取消發布" : confirm === "publish-all" ? "確認全部發布" : "確認移除影片"}
      onCancel={() => { setConfirm(null); setBulkPublishCourse(null); }}
      confirm={<button type="button" disabled={busy} onClick={confirmed} className="btn-gold rounded-lg px-4 py-2">確認</button>}>
      {confirm === "delete-course" ? <>「{editingCourse?.title}」將被刪除。若課程內有影片，系統會拒絕刪除。</>
        : confirm === "move-video" ? <>移到「{destination?.title}」後會退回草稿，需在新課程試播並發布，學員才看得到。</>
          : confirm === "unpublish" ? <>「{editingVideo?.title}」將退回草稿，學員會立即看不到。</>
            : confirm === "publish-all" ? <>「{bulkPublishCourse?.title}」裡所有草稿影片會立即發布，已設定開通對象的學員會立即看到，不會個別要求試播。</>
              : <>「{editingVideo?.title}」將永久移除。</>}
    </ConfirmDialog>}
  </div>;
}
