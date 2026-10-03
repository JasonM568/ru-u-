// Integration exercise against the disposable local Supabase stack only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local","utf8").trim().split("\n")
  .map((line) => { const pos=line.indexOf("="); return [line.slice(0,pos),line.slice(pos+1).replace(/^"|"$/g,"")]; }));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54421","Never run against production");
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function signIn(email) {
  const supabase=client();
  const {error}=await supabase.auth.signInWithPassword({email,password:"SyntheticVideos2026!"});
  assert.ifError(error);
  return supabase;
}
async function ids(supabase) {
  const {data,error}=await supabase.schema("elite").from("course_videos").select("id");
  assert.ifError(error);
  return new Set(data.map((v)=>v.id));
}
async function call(supabase,name,args) {
  const {data,error}=await supabase.schema("elite").rpc(name,args);
  assert.ifError(error);
  return data;
}
const instructor=await signIn("synthetic-videos-instructor@example.test");
const first=await signIn("synthetic-videos-student@example.test");
const second=await signIn("synthetic-videos-second@example.test");
const secondB=client();
let {data:secondBLogin}=await secondB.auth.signInWithPassword({
  email:"synthetic-videos-second-b@example.test",password:"SyntheticVideos2026!"});
if (!secondBLogin.user) {
  const {data:signup,error:signupError}=await secondB.auth.signUp({
    email:"synthetic-videos-second-b@example.test",password:"SyntheticVideos2026!"});
  assert.ifError(signupError);
  assert.ok(signup.user);
  secondBLogin=signup;
}
execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-h","127.0.0.1","-p","54422","-U","postgres","-d","postgres","-c",
  `insert into elite.enrollments(user_id,class_role,cohort,status,display_name) values('${secondBLogin.user.id}','student','2026-2','active','合成二期 B') on conflict(user_id) do nothing;`],
  {env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});

const baseline=await ids(first);
assert.equal(baseline.size,10,"AC12 initial set");
const {error:studentCreate}=await first.schema("elite").rpc("video_create",{
  p_title:"forbidden",p_url:"https://vimeo.com/123456789",p_category:"pre",p_note:""});
assert.ok(studentCreate,"Student cannot call instructor write RPC");
const id=await call(instructor,"video_create",{p_title:"AC draft",p_url:"https://vimeo.com/123456789",p_category:"pre",p_note:""});
assert.ok((await ids(instructor)).has(id));
assert.ok(!(await ids(first)).has(id),"AC3 draft hidden");
assert.ok(!(await ids(second)).has(id),"AC3 second term draft hidden");
assert.deepEqual(await ids(first),baseline,"AC12 original first-term set unchanged");

const save=(cohorts,all,users,publish=true)=>call(instructor,"video_set_audiences",{
  p_video_id:id,p_cohorts:cohorts,p_all:all,p_users:users,p_publish:publish});
await save(["2026-1"],false,[]);
assert.ok((await ids(first)).has(id),"AC1 first term visible");
assert.ok(!(await ids(second)).has(id),"AC1 second term hidden");
await save(["2026-1","2026-2"],false,[]);
assert.ok((await ids(second)).has(id),"AC4 selected second term visible");
await save([],true,[]);
assert.ok((await ids(secondB)).has(id),"AC4 all cohorts visible");
const future=client();
let {data:futureLogin}=await future.auth.signInWithPassword({
  email:"synthetic-videos-future@example.test",password:"SyntheticVideos2026!"});
if (!futureLogin.user) {
  const {data:signup,error}=await future.auth.signUp({
    email:"synthetic-videos-future@example.test",password:"SyntheticVideos2026!"});
  assert.ifError(error); assert.ok(signup.user); futureLogin=signup;
}
execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-h","127.0.0.1","-p","54422","-U","postgres","-d","postgres","-c",
  `insert into elite.cohorts(code,display_name) values('2026-4','2026 第 4 期') on conflict do nothing; insert into elite.enrollments(user_id,class_role,cohort,status,display_name) values('${futureLogin.user.id}','student','2026-4','active','合成未來期學員') on conflict(user_id) do nothing;`],
  {env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
assert.ok((await ids(future)).has(id),"AC4 future cohort included by all");
await save(["2026-1","2026-2"],false,[]);
assert.ok(!(await ids(future)).has(id),"AC4 future cohort excluded by explicit selection");
const secondUser=(await second.auth.getUser()).data.user.id;
await save([],false,[secondUser]);
assert.ok((await ids(second)).has(id),"AC5 personal target visible");
assert.ok(!(await ids(secondB)).has(id),"AC5 other second-term member hidden");
assert.ok(!(await ids(first)).has(id),"AC5 first term hidden");
execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-h","127.0.0.1","-p","54422","-U","postgres","-d","postgres","-c",
  `update elite.enrollments set cohort='2026-3' where user_id='${secondUser}';`],
  {env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
assert.ok((await ids(second)).has(id),"Personal grant survives cohort change");
execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-h","127.0.0.1","-p","54422","-U","postgres","-d","postgres","-c",
  `update elite.enrollments set cohort='2026-2' where user_id='${secondUser}';`],
  {env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
await save([],false,[],false);
assert.ok(!(await ids(second)).has(id),"AC6 unpublish immediate");

const secondPre=await call(instructor,"video_create",{p_title:"AC category",p_url:"https://vimeo.com/123456789",p_category:"pre",p_note:""});
const untouchedDraft=await call(instructor,"video_create",{p_title:"AC category draft",p_url:"https://vimeo.com/123456789",p_category:"pre",p_note:""});
await save(["2026-1"],false,[]);
await call(instructor,"video_set_audiences",{
  p_video_id:secondPre,p_cohorts:["2026-1"],p_all:false,p_users:[],p_publish:true});
await call(instructor,"video_apply_category",{
  p_source_id:id,p_cohorts:["2026-2"],p_all:false,p_users:[],p_publish:true});
assert.ok((await ids(second)).has(id) && (await ids(second)).has(secondPre),"AC7 same category overwritten");
assert.ok(!(await ids(second)).has(untouchedDraft),"AC7 draft remains hidden");
const {data:draftAfterBulk,error:draftError}=await instructor.schema("elite").from("course_videos")
  .select("published_at").eq("id",untouchedDraft).single();
assert.ifError(draftError);
assert.equal(draftAfterBulk.published_at,null,"AC7 draft remains unpublished");
assert.deepEqual(await ids(first),baseline,"AC7 other category untouched");

const {error:directInsert}=await instructor.schema("elite").from("video_audiences")
  .insert({video_id:id,kind:"all"});
assert.ok(directInsert,"Audience direct writes denied");
const {error:directVideoInsert}=await instructor.schema("elite").from("course_videos")
  .insert({title:"bypass",url:"https://vimeo.com/123456789",category:"pre"});
assert.ok(directVideoInsert,"Video direct writes denied");
const {data:studentAudiences,error:audienceError}=await second.schema("elite").from("video_audiences").select("video_id");
assert.ifError(audienceError);
assert.equal(studentAudiences.length,0,"Audience rows hidden from students");

await call(instructor,"video_delete",{p_video_id:id});
await call(instructor,"video_delete",{p_video_id:secondPre});
await call(instructor,"video_delete",{p_video_id:untouchedDraft});
assert.deepEqual(await ids(first),baseline,"AC12 set restored after exercise");
console.log("AC1/2/3/4/5/6/7/8/12 and ACL/RPC integration checks passed on local Supabase");
