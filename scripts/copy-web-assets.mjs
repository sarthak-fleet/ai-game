import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "web", "assets");
const target = join(root, "dist", "web", "assets");

if (!existsSync(source)) {
  throw new Error(`Missing web asset source: ${source}`);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, force: true });
console.info(`Copied web runtime assets to ${target}`);

const headersSource = join(root, "web", "_headers");
const headersTarget = join(root, "dist", "web", "_headers");
if (existsSync(headersSource)) {
  cpSync(headersSource, headersTarget, { force: true });
  console.info(`Copied Cloudflare Pages headers to ${headersTarget}`);
}
