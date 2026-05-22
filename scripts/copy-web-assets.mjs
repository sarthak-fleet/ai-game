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
