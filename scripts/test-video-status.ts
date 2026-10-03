import assert from "node:assert/strict";
import { inspectVideo } from "../lib/video-status";

async function main() {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("", { status: 401 });
    assert.equal(await inspectVideo("https://youtu.be/Private401Demo"), "private");
    globalThis.fetch = async () => new Response("", { status: 403 });
    assert.equal(await inspectVideo("https://youtu.be/PrivateDemo123"), "private");
    globalThis.fetch = async () => new Response("", { status: 404 });
    assert.equal(await inspectVideo("https://youtu.be/Processing123"), "unknown");
    globalThis.fetch = async () => new Response("", { status: 429 });
    assert.equal(await inspectVideo("https://youtu.be/RateLimit123"), "unknown");
    globalThis.fetch = async () => new Response("", { status: 503 });
    assert.equal(await inspectVideo("https://youtu.be/ServerError123"), "unknown");
    globalThis.fetch = async () => { throw new Error("timeout"); };
    assert.equal(await inspectVideo("https://youtu.be/TimeoutDemo123"), "unknown");
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.next?.revalidate, 600);
      return new Response("{}", { status: 200 });
    };
    assert.equal(await inspectVideo("https://youtu.be/PublicDemo123"), "ready");
    console.log("Video status: 401/403 private; 404/429/503/timeout unknown; 200 ready; 600s cache");
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
