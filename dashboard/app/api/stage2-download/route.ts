import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
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
    return NextResponse.json({ error: "no folder" }, { status: 400 });
  }

  const filePath = join(folder, "Trend_report.hwpx");

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const buf = await readFile(filePath);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="Trend_report.hwpx"`,
      "Content-Length": String(buf.length),
    },
  });
}
