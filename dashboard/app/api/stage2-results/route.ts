import { NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

const STATE_PATH = join(process.cwd(), "public", "stage2-state.json");

async function readFolder(): Promise<string | null> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const state = JSON.parse(raw);
    return state?.folder ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const folder = await readFolder();
  if (!folder) {
    return NextResponse.json({ exists: false, folder: null, charts: [], hwpxReady: false });
  }

  const assetsDir = join(folder, "_report_assets");

  try {
    await stat(assetsDir);
  } catch {
    return NextResponse.json({ exists: false, folder, charts: [], hwpxReady: false });
  }

  const files = await readdir(assetsDir);

  const charts: {
    id: number;
    image: string | null;
    stats: Record<string, unknown> | null;
    bullets: { chart_id: number; subtitle: string; caption: string; bullets: string[] } | null;
  }[] = [];

  for (let n = 1; n <= 10; n++) {
    const pngFile = `chart_${n}.png`;
    const statsFile = `stats_${n}.json`;
    const bulletsFile = `bullets_${n}.json`;

    let image: string | null = null;
    let statsData: Record<string, unknown> | null = null;
    let bulletsData: { chart_id: number; subtitle: string; caption: string; bullets: string[] } | null = null;

    if (files.includes(pngFile)) {
      try {
        const buf = await readFile(join(assetsDir, pngFile));
        image = `data:image/png;base64,${buf.toString("base64")}`;
      } catch { /* skip */ }
    }

    if (files.includes(statsFile)) {
      try {
        const raw = await readFile(join(assetsDir, statsFile), "utf-8");
        statsData = JSON.parse(raw);
      } catch { /* skip */ }
    }

    if (files.includes(bulletsFile)) {
      try {
        const raw = await readFile(join(assetsDir, bulletsFile), "utf-8");
        bulletsData = JSON.parse(raw);
      } catch { /* skip */ }
    }

    if (image || statsData || bulletsData) {
      charts.push({ id: n, image, stats: statsData, bullets: bulletsData });
    }
  }

  let hwpxReady = false;
  try {
    await stat(join(folder, "Trend_report.hwpx"));
    hwpxReady = true;
  } catch { /* not ready */ }

  return NextResponse.json({ exists: true, folder, charts, hwpxReady });
}
