import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stagingDir = path.join(rootDir, "web-ext-staging");
const artifactsDir = path.join(rootDir, "web-ext-artifacts");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit", cwd: rootDir });
}

console.log("Building extension...");
run("node", ["build.js"]);

console.log("Staging shippable files...");
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, "manifest.json"), path.join(stagingDir, "manifest.json"));
copyRecursive(path.join(rootDir, "dist"), path.join(stagingDir, "dist"));
copyRecursive(path.join(rootDir, "icons"), path.join(stagingDir, "icons"));

console.log("Linting extension...");
run("pnpm", ["exec", "web-ext", "lint", "--source-dir", stagingDir]);

console.log("Building web-ext package...");
run("pnpm", [
  "exec", "web-ext", "build",
  "--source-dir", stagingDir,
  "--artifacts-dir", artifactsDir,
  "--overwrite-dest",
]);

fs.rmSync(stagingDir, { recursive: true, force: true });
console.log(`Done. Package written to ${path.relative(rootDir, artifactsDir)}/`);
