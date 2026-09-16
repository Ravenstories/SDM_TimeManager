import { mkdir, cp, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = ["index.html", "icon.svg", "manifest.webmanifest"];
for (const entry of await readdir("src"))
  if (entry.endsWith(".js") || entry.endsWith(".css"))
    files.push("src/" + entry);
const hash = createHash("sha256");
for (const file of [...files, "sw.js"].sort())
  hash.update(file).update(await readFile(file));
const version = "2.0-" + hash.digest("hex").slice(0, 12);
await mkdir("dist", { recursive: true });
for (const file of files) {
  await mkdir("dist/" + file.split("/").slice(0, -1).join("/"), {
    recursive: true,
  });
  await cp(file, "dist/" + file);
}
await writeFile(
  "dist/src/version.js",
  "export const VERSION = " + JSON.stringify(version) + ";\n",
);
let worker = await readFile("sw.js", "utf8");
worker = worker.replace(
  /const CACHE = .*?;/,
  "const CACHE = CACHE_PREFIX + " + JSON.stringify(version) + ";",
);
worker = worker.replace(
  /const FILES = \[[\s\S]*?\];/,
  "const FILES = " +
    JSON.stringify(["./", ...files.map((file) => "./" + file)]) +
    ";",
);
await writeFile("dist/sw.js", worker);
console.log("Static site ready in dist/ · " + version);
