import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

const STATE_PATH = join(process.cwd(), "public", "stage3-state.json");

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
    return NextResponse.json({ exists: false, folder: null, dashboard: null, hwpxReady: false });
  }

  const assetsDir = join(folder, "_quality_assets");

  // Read dashboard_data.json
  let dashboard = null;
  try {
    const raw = await readFile(join(assetsDir, "dashboard_data.json"), "utf-8");
    dashboard = JSON.parse(raw);
  } catch { /* not ready yet */ }

  // Check HWPX
  let hwpxReady = false;
  try {
    await stat(join(folder, "Quality_report.hwpx"));
    hwpxReady = true;
  } catch { /* not ready */ }

  return NextResponse.json({
    exists: !!dashboard,
    folder,
    dashboard,
    hwpxReady,
  });
}
