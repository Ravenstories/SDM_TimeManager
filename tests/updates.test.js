import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
function harness({ failDownload = false } = {}) {
  const handlers = {}, calls = [];
  vm.runInNewContext(worker, {
    URL, Request,
    self: {
      location: new URL("https://example.com/SDM_TimeManager/sw.js"),
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => calls.push("activate-new"),
      clients: { claim: async () => calls.push("claim-tabs") },
    },
    caches: {
      open: async (name) => ({
        addAll: async (requests) => {
          calls.push("download");
          assert.ok(requests.every((r) => r.cache === "reload"));
          assert.ok(requests.every((r) => r.url.startsWith("https://example.com/SDM_TimeManager/")));
          if (failDownload) throw new Error("Offline");
          calls.push("complete-shell");
        },
        match: async () => name === "sdm-shell-dev-v12" ? "current-shell" : "stale-shell",
      }),
      keys: async () => ["sdm-shell-v11", "sdm-shell-dev-v12", "another-app"],
      delete: async (key) => calls.push(`delete:${key}`),
    },
  });
  return { calls, run(type) {
    let result;
    handlers[type]({
      waitUntil: (promise) => { result = promise; },
      respondWith: (promise) => { result = promise; },
      request: new Request("https://example.com/SDM_TimeManager/index.html"),
    });
    return result;
  } };
}

test("updates activate only after a complete fresh shell and claim open tabs", async () => {
  const h = harness();
  await h.run("install");
  await h.run("activate");
  assert.deepEqual(h.calls, ["download", "complete-shell", "activate-new", "delete:sdm-shell-v11", "claim-tabs"]);
  assert.equal(await h.run("fetch"), "current-shell");
});

test("an incomplete update does not activate over the working version", async () => {
  const h = harness({ failDownload: true });
  await assert.rejects(h.run("install"), /Offline/);
  assert.deepEqual(h.calls, ["download"]);
});

test("build cache versions are stable and change automatically with any shipped asset", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sdm-build-"));
  try {
    for (const path of ["scripts", "src", "index.html", "sw.js", "icon.svg", "manifest.webmanifest"])
      await cp(new URL(`../${path}`, import.meta.url), join(directory, path), { recursive: true });
    const build = async () => {
      execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: directory });
      return readFile(join(directory, "dist/sw.js"), "utf8");
    };
    const first = await build();
    assert.match(first, /sdm-shell-[a-f0-9]{20}/);
    assert.equal(await build(), first);
    await writeFile(join(directory, "src/styles.css"), "/* new release */");
    assert.notEqual(await build(), first);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
