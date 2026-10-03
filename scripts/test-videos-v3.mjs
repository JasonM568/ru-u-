// Integration checks against the disposable local Supabase stack only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local","utf8").trim().split("\n")
  .map((line) => { const pos=line.indexOf("="); return [line.slice(0,pos),line.slice(pos+1).replace(/^"|"$/g,"")]; }));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54521","Local-only test guard");
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function signIn(email) {
  const supabase=client();
  const {error}=await supabase.auth.signInWithPassword({email,password:"SyntheticVideos2026!"});
  assert.ifError(error);
  return supabase;
}
async function extraStudent(email,cohort,status="active") {
  const supabase=client();
  let {data,error}=await supabase.auth.signInWithPassword({email,password:"SyntheticVideos2026!"});
  if (error || !data.user) {
    const signup=await supabase.auth.signUp({email,password:"SyntheticVideos2026!"});
    assert.ifError(signup.error); data=signup.data;
  }
  assert.ok(data.user);
  execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-h","127.0.0.1","-p","54522","-U","postgres","-d","postgres","-c",
    `insert into elite.enrollments(user_id,class_role,cohort,status,display_name) values('${data.user.id}','student','${cohort}','${status}','Synthetic extra') on conflict(user_id) do update set cohort=excluded.cohort,status=excluded.status;`],
    {env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
  return supabase;
}
async function ids(supabase,table) {
  const {data,error}=await supabase.schema("elite").from(table).select("id");
  assert.ifError(error);
  return new Set(data.map((row)=>row.id));
}
async function rpc(supabase,name,args) {
  const {data,error}=await supabase.schema("elite").rpc(name,args);
  assert.ifError(error);
  return data;
}

const instructor=await signIn("synthetic-videos-instructor@example.test");
const first=await signIn("synthetic-videos-student@example.test");
const second=await signIn("synthetic-videos-second@example.test");
const secondB=await extraStudent("synthetic-videos-second-b@example.test","2026-2");
const suspended=await extraStudent("synthetic-videos-suspended@example.test","2026-1","suspended");
const baselineVideos=await ids(first,"course_videos");
const baselineCourses=await ids(first,"video_courses");
assert.equal(baselineVideos.size,10);
assert.equal(baselineCourses.size,1);
assert.equal((await ids(second,"video_courses")).size,0,"AC1 second cohort course hidden");
assert.equal((await ids(second,"course_videos")).size,0,"AC2 second cohort videos hidden by RLS");
assert.equal((await ids(suspended,"video_courses")).size,0,"AC6 suspended course hidden");
assert.equal((await ids(suspended,"course_videos")).size,0,"AC6 suspended videos hidden");
const originalCourse=[...baselineCourses][0];
const {data:directCourse,error:directError}=await second.schema("elite").from("video_courses")
  .select("id").eq("id",originalCourse).maybeSingle();
assert.ifError(directError); assert.equal(directCourse,null,"AC1 direct course ID hidden");
const {error:studentCreate}=await first.schema("elite").rpc("video_course_create",{
  p_title:"Forbidden student course",p_note:""});
assert.ok(studentCreate,"Student cannot call instructor course-create RPC");
const {error:studentDirectCourse}=await first.schema("elite").from("video_courses")
  .insert({title:"Forbidden direct course"});
assert.ok(studentDirectCourse,"Student cannot directly insert video_courses");
const {error:studentDirectGrant}=await first.schema("elite").from("course_grants")
  .insert({course_id:originalCourse,kind:"cohort",cohort_code:"2026-2"});
assert.ok(studentDirectGrant,"Student cannot directly insert course_grants");

const empty=await rpc(instructor,"video_course_create",{p_title:"Synthetic empty course",p_note:""});
await rpc(instructor,"video_course_set_grants",{p_course_id:empty,p_cohorts:["2026-1"],p_users:[]});
assert.ok(!(await ids(first,"video_courses")).has(empty),"AC8 granted course with no published video hidden");
const draft=await rpc(instructor,"course_video_create",{
  p_course_id:empty,p_title:"Synthetic draft",p_url:"https://vimeo.com/123456789",p_category:"day2",p_note:""});
const {error:studentPublish}=await first.schema("elite").rpc("course_video_publish",{
  p_video_id:draft,p_publish:true});
assert.ok(studentPublish,"Student cannot call instructor publish RPC");
assert.ok((await ids(instructor,"course_videos")).has(draft),"AC3 instructor sees draft");
assert.ok(!(await ids(first,"course_videos")).has(draft),"AC3 student cannot see draft");
assert.ok(!(await ids(first,"video_courses")).has(empty),"AC8 course with only drafts hidden");
await rpc(instructor,"course_video_publish",{p_video_id:draft,p_publish:true});
assert.ok((await ids(first,"course_videos")).has(draft),"AC3 published visible");
assert.ok((await ids(first,"video_courses")).has(empty),"AC3 course visible after publication");
const suspendedId=(await suspended.auth.getUser()).data.user.id;
await rpc(instructor,"video_course_set_grants",{
  p_course_id:empty,p_cohorts:[],p_users:[suspendedId]});
assert.equal((await ids(suspended,"video_courses")).size,0,"AC6 personally granted suspended course hidden");
assert.equal((await ids(suspended,"course_videos")).size,0,"AC6 personally granted suspended video hidden");
const {error:nullPublish}=await instructor.schema("elite").rpc("course_video_publish",{
  p_video_id:draft,p_publish:null});
assert.match(nullPublish?.message ?? "",/publish flag required/,"Null publish flag rejected");
const {data:stillPublished,error:stillPublishedError}=await instructor.schema("elite")
  .from("course_videos").select("published_at").eq("id",draft).single();
assert.ifError(stillPublishedError);
assert.ok(stillPublished.published_at,"Null flag must not unpublish the video");
await rpc(instructor,"course_video_publish",{p_video_id:draft,p_publish:false});
assert.ok(!(await ids(first,"course_videos")).has(draft),"AC3 unpublish hides immediately");

await rpc(instructor,"video_course_set_grants",{p_course_id:empty,p_cohorts:["2026-1","2026-2"],p_users:[]});
await rpc(instructor,"course_video_publish",{p_video_id:draft,p_publish:true});
assert.ok((await ids(first,"video_courses")).has(empty),"AC4 first cohort visible");
assert.ok((await ids(second,"video_courses")).has(empty),"AC4 second cohort visible");
const secondId=(await second.auth.getUser()).data.user.id;
await rpc(instructor,"video_course_set_grants",{p_course_id:empty,p_cohorts:[],p_users:[secondId]});
assert.ok((await ids(second,"video_courses")).has(empty),"AC5 personal grant works");
assert.ok(!(await ids(secondB,"video_courses")).has(empty),"AC5 other same-cohort student hidden");
assert.ok(!(await ids(first,"video_courses")).has(empty),"AC5 first cohort no longer granted");
const {error:directGrant}=await instructor.schema("elite").from("course_grants")
  .insert({course_id:empty,kind:"cohort",cohort_code:"2026-3"});
assert.ok(directGrant,"Direct grant writes denied by ACL");
const {data:studentGrants,error:readGrantError}=await first.schema("elite").from("course_grants").select("id");
assert.ifError(readGrantError); assert.equal(studentGrants.length,0,"Grant rows hidden from students");

const {error:nonemptyDelete}=await instructor.schema("elite").rpc("video_course_delete",{p_course_id:empty});
assert.match(nonemptyDelete?.message ?? "",/請先移出或刪除課程內的 1 支影片/,"Nonempty course deletion message");
await rpc(instructor,"course_video_move",{p_video_id:draft,p_course_id:originalCourse});
const {data:moved,error:movedError}=await instructor.schema("elite").from("course_videos")
  .select("course_id,published_at").eq("id",draft).single();
assert.ifError(movedError);
assert.equal(moved.course_id,originalCourse);
assert.equal(moved.published_at,null,"Move resets publication");
assert.ok(!(await ids(first,"course_videos")).has(draft),"Move does not expose draft to target course");
await rpc(instructor,"course_video_publish",{p_video_id:draft,p_publish:true});
assert.ok((await ids(first,"course_videos")).has(draft),"Publish after move uses target course grant");
await rpc(instructor,"course_video_delete",{p_video_id:draft});
await rpc(instructor,"video_course_delete",{p_course_id:empty});
assert.deepEqual(await ids(first,"course_videos"),baselineVideos,"AC10 baseline videos restored");
assert.deepEqual(await ids(first,"video_courses"),baselineCourses,"AC10 baseline course restored");
console.log("Videos v3 local AC1/2/3/4/5/6/8, suspended personal grant, denied student writes, move/delete, ACL and baseline checks passed");
