import assert from "node:assert/strict";
import { inspectVideo } from "../lib/video-status";

async function main() {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("", { status: 403 });
    assert.equal(await inspectVideo("https://youtu.be/PrivateDemo123"), "private");
    globalThis.fetch = async () => new Response("", { status: 404 });
    assert.equal(await inspectVideo("https://youtu.be/Processing123"), "processing");
    globalThis.fetch = async () => new Response("{}", { status: 200 });
    assert.equal(await inspectVideo("https://youtu.be/PublicDemo123"), "ready");
    console.log("Video status: YouTube 403 private, 404 processing, 200 ready");
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
