import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const isWatch = process.argv.includes("--watch");
const isDev = isWatch || process.argv.includes("--dev");

const entryPoints = [
  { in: "src/background/background.ts", out: "dist/background/background" },
  { in: "src/sidebar/sidebar.tsx",      out: "dist/sidebar/sidebar" },
  { in: "src/content/content.ts",       out: "dist/content/content" },
  { in: "src/options/options.ts",       out: "dist/options/options" },
];

/** @type {import("esbuild").BuildOptions} */
const sharedConfig = {
  bundle: true,
  target: "firefox115",
  jsx: "automatic",
  jsxImportSource: "preact",
  sourcemap: isDev,
  minify: !isDev,
  logLevel: "info",
};

function copyStaticFiles() {
  const copies = [
    ["src/sidebar/sidebar.html", "dist/sidebar/sidebar.html"],
    ["src/sidebar/sidebar.css",  "dist/sidebar/sidebar.css"],
    ["src/options/options.html", "dist/options/options.html"],
    ["src/options/options.css",  "dist/options/options.css"],
  ];
  for (const [src, dest] of copies) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}

async function build() {
  copyStaticFiles();

  const ctx = await esbuild.context({
    ...sharedConfig,
    entryPoints,
    outdir: ".",
    entryNames: "[dir]/[name]",
  });

  if (isWatch) {
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
