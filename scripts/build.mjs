import { mkdir, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const file of [
  "index.html",
  "src",
  "icon.svg",
  "manifest.webmanifest",
  "sw.js",
])
  await cp(file, `dist/${file}`, { recursive: true });
console.log("Static site ready in dist/");
