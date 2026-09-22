import { mkdir, cp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of [
  "index.html",
  "src",
  "icon.svg",
  "manifest.webmanifest",
  "sw.js",
])
  await cp(file, `dist/${file}`, { recursive: true });
// Every asset change produces a new worker, without a manual version bump.
const hash = createHash("sha256");
async function hashFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await hashFiles(path);
    else hash.update(path).update("\0").update(await readFile(path)).update("\0");
  }
}
await hashFiles("dist");
const worker = await readFile("dist/sw.js", "utf8");
await writeFile("dist/sw.js", worker.replace(
  '"sdm-shell-dev-v12"', `"sdm-shell-${hash.digest("hex").slice(0, 20)}"`,
));
console.log("Static site ready in dist/");
