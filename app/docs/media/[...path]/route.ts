import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocMedia } from "@/lib/server/docs";

// Images used by the docs, made at build time: each is resized to at most 1800 px wide and
// served as WebP. Only images that a published doc shows are listed, so nothing else in the
// repository can be read through this route.

export const dynamic = "force-static";
export const dynamicParams = false;

const MAX_WIDTH = 1800;

export function generateStaticParams() {
  return getDocMedia().map((p) => ({ path: p.split("/") }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const repoPath = (await params).path.map(decodeURIComponent).join("/");
  if (!getDocMedia().includes(repoPath)) return new Response("Not found", { status: 404 });
  const source = await readFile(path.join(process.cwd(), repoPath));
  const sharp = (await import("sharp")).default;
  const body = await sharp(source).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
