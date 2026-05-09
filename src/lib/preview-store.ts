import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function previewDir() {
  return process.env.PREVIEW_DIR ?? path.join(process.cwd(), ".previews");
}

function fileFor(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    throw new Error("invalid preview id");
  }
  return path.join(previewDir(), `${id}.html`);
}

export function newPreviewId() {
  return randomUUID();
}

export async function saveHtml(id: string, html: string) {
  const dir = previewDir();
  await mkdir(dir, { recursive: true });
  await writeFile(fileFor(id), html, "utf8");
  void cleanupExpired();
}

export async function loadHtml(
  id: string,
): Promise<{ html: string; expiresAt: number } | null> {
  let info;
  try {
    info = await stat(fileFor(id));
  } catch {
    return null;
  }
  const expiresAt = info.mtimeMs + EXPIRY_MS;
  if (expiresAt <= Date.now()) {
    try {
      await unlink(fileFor(id));
    } catch {
      // best effort
    }
    return null;
  }
  const html = await readFile(fileFor(id), "utf8");
  return { html, expiresAt };
}

export function expiryMs() {
  return EXPIRY_MS;
}

async function cleanupExpired() {
  const dir = previewDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  const now = Date.now();
  await Promise.all(
    entries
      .filter((name) => name.endsWith(".html"))
      .map(async (name) => {
        const full = path.join(dir, name);
        try {
          const info = await stat(full);
          if (info.mtimeMs + EXPIRY_MS <= now) {
            await unlink(full);
          }
        } catch {
          // best effort
        }
      }),
  );
}
