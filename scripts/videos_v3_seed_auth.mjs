// Local Supabase stack only: attach three synthetic Auth accounts to the fixture.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local","utf8").trim().split("\n")
  .map((line) => { const pos = line.indexOf("="); return [line.slice(0,pos), line.slice(pos+1).replace(/^"|"$/g,"")]; }));
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54521") throw new Error("Local-only seed guard");
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const accounts = [
  ["synthetic-videos-student@example.test","00000000-0000-0000-0000-000000000001"],
  ["synthetic-videos-instructor@example.test","00000000-0000-0000-0000-000000000100"],
  ["synthetic-videos-second@example.test","00000000-0000-0000-0000-000000000201"],
];
for (const [email, oldId] of accounts) {
  const {data,error} = await client.auth.signUp({email,password:"SyntheticVideos2026!"});
  if (error || !data.user) throw error ?? new Error(`Sign-up failed: ${email}`);
  const id = data.user.id;
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid synthetic UUID");
  execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-h","127.0.0.1","-p","54522","-U","postgres","-d","postgres","-c",
    `update elite.enrollments set user_id='${id}' where user_id='${oldId}';`],
    {env:{...process.env,PGPASSWORD:"postgres"},stdio:"ignore"});
  console.log(`Local synthetic ${email}: ready`);
}
