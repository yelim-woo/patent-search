"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import StageNav from "@/components/StageNav";
import { getStageBySlug } from "@/lib/stages";

// ---- Types ----
type SankeyData = {
  years: number[];
  themes: { id: string; name: string }[];
  data: Record<string, number[]>;
  periods: { period: number; label: string }[];
};
type OSCell = {
  objectId: string; objectName: string;
  solutionId: string; solutionName: string;
  periods: number[]; total: number; tags: string[];
};
type OSMatrixData = {
  objects: { id: string; name: string }[];
  solutions: { id: string; name: string }[];
  periods: { period: number; label: string }[];
  cells: OSCell[];
};
type DashboardData = { sankey: SankeyData; osMatrix: OSMatrixData; detailOsMatrix?: OSMatrixData | null };
type Stage3Result = {
  exists: boolean; folder: string | null;
  dashboard: DashboardData | null; hwpxReady: boolean;
};

const THEME_COLORS = [
  "#4A90D9", "#E07070", "#5DC49E", "#F5B84C", "#9B7BD4",
  "#E8917A", "#6BC5D2", "#B8D458", "#D4A0C0", "#8B9DC3",
];
const PERIOD_COLORS = ["#4A90D9", "#E07070", "#5DC49E", "#F5B84C"];

type FilterTag = "all" | "growth" | "new" | "blank" | "meaningless";
const FILTER_OPTIONS: { tag: FilterTag; label: string; emoji: string; color: string; desc: string }[] = [
  { tag: "all", label: "전체", emoji: "", color: "#666", desc: "" },
  { tag: "growth", label: "성장", emoji: "🟢", color: "#27AE60", desc: "연평균 30%↑ 또는 1구간 대비 2배↑" },
  { tag: "new", label: "신규", emoji: "🟡", color: "#F1C40F", desc: "1·2구간 0건, 3구간 이후 출현" },
  { tag: "blank", label: "공백", emoji: "🔵", color: "#3498DB", desc: "합계 ≤15건, 또는 비성장+≤30건" },
  { tag: "meaningless", label: "무의미", emoji: "⚪", color: "#BDC3C7", desc: "모든 구간 0건" },
];

// ---- Bump Chart (rank flow per year) ----
function BumpChart({ data }: { data: SankeyData }) {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; theme: string; year: number; rank: number; count: number } | null>(null);
  const years = data.years;
  const themes = data.themes;
  if (!years.length || !themes.length) return <p className="text-muted">데이터 없음</p>;

  const W = Math.max(1000, years.length * 28);
  const H = 480;
  const PAD = { top: 30, right: 130, bottom: 40, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const nRanks = themes.length;

  const xScale = (i: number) => PAD.left + (i / (years.length - 1 || 1)) * plotW;
  const yScale = (rank: number) => PAD.top + ((rank - 1) / (nRanks - 1 || 1)) * plotH;

  // Compute ranks per year (1 = highest count)
  const yearRanks: Record<string, number>[] = []; // per year: themeId → rank
  for (let yi = 0; yi < years.length; yi++) {
    const counts = themes.map((t) => ({ id: t.id, count: data.data[t.id]?.[yi] || 0 }));
    counts.sort((a, b) => b.count - a.count);
    const ranks: Record<string, number> = {};
    counts.forEach((c, i) => { ranks[c.id] = i + 1; });
    yearRanks.push(ranks);
  }

  // Build smooth line paths per theme
  const themeLines = themes.map((theme, ti) => {
    const points = years.map((_, yi) => ({
      x: xScale(yi),
      y: yScale(yearRanks[yi][theme.id] || nRanks),
      rank: yearRanks[yi][theme.id] || nRanks,
      count: data.data[theme.id]?.[yi] || 0,
    }));

    // Catmull-Rom to smooth SVG path
    let path = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cpx = (points[i].x + points[i + 1].x) / 2;
      path += ` C${cpx},${points[i].y} ${cpx},${points[i + 1].y} ${points[i + 1].x},${points[i + 1].y}`;
    }
    return { id: theme.id, name: theme.name, path, points };
  });

  const step = years.length > 30 ? 5 : years.length > 15 ? 2 : 1;

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: W, display: "block" }}>
        {/* Rank grid lines */}
        {Array.from({ length: nRanks }, (_, i) => (
          <g key={`rank-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yScale(i + 1)} y2={yScale(i + 1)}
                  stroke="#f0f0f0" strokeWidth={1} />
            <text x={PAD.left - 8} y={yScale(i + 1) + 4} textAnchor="end"
                  fontSize={11} fill="#bbb" fontWeight={300}>
              {i + 1}
            </text>
          </g>
        ))}

        {/* Year grid + labels */}
        {years.map((y, i) => {
          if (i % step !== 0 && i !== years.length - 1) return null;
          return (
            <g key={y}>
              <line x1={xScale(i)} x2={xScale(i)} y1={PAD.top} y2={H - PAD.bottom}
                    stroke="#f5f5f5" strokeWidth={0.5} />
              <text x={xScale(i)} y={H - 12} textAnchor="middle" fontSize={10} fill="#888">{y}</text>
            </g>
          );
        })}

        {/* Theme lines */}
        {themeLines.map((tl, ti) => {
          const isHovered = hoveredTheme === tl.id;
          const dimmed = hoveredTheme !== null && !isHovered;
          const color = THEME_COLORS[ti % THEME_COLORS.length];
          return (
            <g key={tl.id}
               onMouseEnter={() => setHoveredTheme(tl.id)}
               onMouseLeave={() => { setHoveredTheme(null); setTooltip(null); }}
               style={{ cursor: "pointer" }}>
              {/* Line */}
              <path d={tl.path} fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 4 : 2.5}
                    strokeOpacity={dimmed ? 0.12 : 0.9}
                    strokeLinecap="round"
                    style={{ transition: "stroke-opacity 0.2s, stroke-width 0.15s" }} />
              {/* Dots at each year */}
              {tl.points.map((pt, yi) => (
                <circle key={yi} cx={pt.x} cy={pt.y} r={isHovered ? 5 : 3}
                        fill={color} fillOpacity={dimmed ? 0.1 : 1}
                        stroke="#fff" strokeWidth={isHovered ? 2 : 1}
                        style={{ transition: "fill-opacity 0.2s" }}
                        onMouseEnter={(e) => {
                          setHoveredTheme(tl.id);
                          setTooltip({ x: pt.x, y: pt.y, theme: tl.name, year: years[yi], rank: pt.rank, count: pt.count });
                        }}
                        onMouseLeave={() => setTooltip(null)} />
              ))}
            </g>
          );
        })}

        {/* Right-side labels (at last year's rank position) */}
        {themeLines.map((tl, ti) => {
          const lastPt = tl.points[tl.points.length - 1];
          const color = THEME_COLORS[ti % THEME_COLORS.length];
          const isHovered = hoveredTheme === tl.id;
          const dimmed = hoveredTheme !== null && !isHovered;
          return (
            <text key={`lbl-${tl.id}`} x={W - PAD.right + 10} y={lastPt.y + 4}
                  fontSize={11} fill={color}
                  fontWeight={isHovered ? 700 : 500}
                  fillOpacity={dimmed ? 0.25 : 1}
                  style={{ cursor: "pointer", transition: "fill-opacity 0.2s" }}
                  onMouseEnter={() => setHoveredTheme(tl.id)}
                  onMouseLeave={() => { setHoveredTheme(null); setTooltip(null); }}>
              {tl.name}
            </text>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect x={tooltip.x - 70} y={tooltip.y - 52} width={140} height={42}
                  rx={6} fill="#333" fillOpacity={0.92} />
            <text x={tooltip.x} y={tooltip.y - 36} textAnchor="middle"
                  fontSize={11} fill="#fff" fontWeight={700}>
              {tooltip.theme} ({tooltip.year})
            </text>
            <text x={tooltip.x} y={tooltip.y - 20} textAnchor="middle"
                  fontSize={10} fill="#ccc">
              {tooltip.rank}위 · {tooltip.count.toLocaleString()}건
            </text>
          </g>
        )}

        {/* Axis labels */}
        <text x={PAD.left - 8} y={PAD.top - 10} fontSize={11} fill="#999" textAnchor="end">순위</text>
      </svg>
    </div>
  );
}

// ---- O/S Matrix with 4×4 diagonal sub-grid ----
function OSMatrix({ data }: { data: OSMatrixData }) {
  const [activeFilter, setActiveFilter] = useState<FilterTag>("all");
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const nPeriods = data.periods.length;

  const cellMap = useMemo(() => {
    const map: Record<string, OSCell> = {};
    for (const c of data.cells) map[`${c.objectId}_${c.solutionId}`] = c;
    return map;
  }, [data.cells]);

  const globalMax = useMemo(() => {
    let m = 1;
    for (const c of data.cells) for (const v of c.periods) if (v > m) m = v;
    return m;
  }, [data.cells]);

  const isCellActive = (cell: OSCell) => activeFilter === "all" || cell.tags.includes(activeFilter);

  const getCellTag = (cell: OSCell): FilterTag | null => {
    for (const opt of FILTER_OPTIONS) {
      if (opt.tag !== "all" && cell.tags.includes(opt.tag)) return opt.tag;
    }
    return null;
  };

  const valColor = (val: number, periodIdx: number) => {
    if (val === 0) return "#f5f5f5";
    const intensity = Math.min(1, Math.sqrt(val / globalMax)); // sqrt for better spread
    const base = PERIOD_COLORS[periodIdx % PERIOD_COLORS.length];
    const r = parseInt(base.slice(1, 3), 16);
    const g = parseInt(base.slice(3, 5), 16);
    const b = parseInt(base.slice(5, 7), 16);
    const mix = (c: number) => Math.round(255 - intensity * (255 - c));
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  };

  // Count per tag
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opt of FILTER_OPTIONS) counts[opt.tag] = 0;
    for (const c of data.cells) {
      for (const t of c.tags) {
        if (counts[t] !== undefined) counts[t]++;
      }
    }
    counts["all"] = data.cells.length;
    return counts;
  }, [data.cells]);

  return (
    <div>
      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTER_OPTIONS.map((f) => (
          <button key={f.tag} onClick={() => setActiveFilter(f.tag)}
            title={f.desc}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
              border: activeFilter === f.tag ? `2px solid ${f.color}` : "1px solid #ccc",
              background: activeFilter === f.tag ? f.color : "#fff",
              color: activeFilter === f.tag ? "#fff" : "#333",
              fontWeight: activeFilter === f.tag ? 700 : 400,
              transition: "all 0.15s",
            }}>
            {f.emoji} {f.label} ({tagCounts[f.tag]})
          </button>
        ))}
      </div>

      {/* Period legend + sub-grid explanation */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12, color: "#666", flexWrap: "wrap" }}>
        {data.periods.map((p, i) => (
          <span key={p.period} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: PERIOD_COLORS[i], display: "inline-block" }} />
            {p.label}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        각 셀의 대각선 = 구간별 특허 수 (색이 진할수록 많음)
      </div>

      {/* Matrix */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 10px", background: "#f0f0f0", fontSize: 12, fontWeight: 700, border: "1px solid #ddd", position: "sticky", left: 0, zIndex: 2 }}>
                Object \ Solution
              </th>
              {data.solutions.map((s) => (
                <th key={s.id} style={{ padding: "8px 4px", background: "#f0f0f0", fontSize: 11, fontWeight: 600, textAlign: "center", border: "1px solid #ddd", minWidth: 100 }}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.objects.map((o) => (
              <tr key={o.id}>
                <td style={{ padding: "8px 10px", background: "#f8f8f8", fontSize: 12, fontWeight: 600, border: "1px solid #ddd", whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1 }}>
                  {o.name}
                </td>
                {data.solutions.map((s) => {
                  const cell = cellMap[`${o.id}_${s.id}`];
                  if (!cell) return <td key={s.id} style={{ border: "1px solid #eee", background: "#fafafa" }} />;
                  const active = isCellActive(cell);
                  const isHovered = hoveredCell === `${o.id}_${s.id}`;
                  const tag = getCellTag(cell);
                  const tagOpt = FILTER_OPTIONS.find((f) => f.tag === tag);
                  const borderColor = (active && activeFilter !== "all" && tag === activeFilter)
                    ? (tagOpt?.color || "#ddd") : "#ddd";
                  const borderW = (active && activeFilter !== "all" && tag === activeFilter) ? 2.5 : 1;

                  return (
                    <td key={s.id}
                        onMouseEnter={() => setHoveredCell(`${o.id}_${s.id}`)}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          padding: 2, border: `${borderW}px solid ${borderColor}`,
                          opacity: active ? 1 : 0.2, transition: "all 0.2s",
                          position: "relative", verticalAlign: "middle",
                          background: tag === "meaningless" ? "#f9f9f9" : "#fff",
                        }}>
                      {/* Tag indicator dot */}
                      {tag && tagOpt && (
                        <div style={{
                          position: "absolute", top: 1, right: 2, fontSize: 8, lineHeight: 1,
                        }}>{tagOpt.emoji}</div>
                      )}

                      {/* 4×4 sub-grid */}
                      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                        <tbody>
                          {data.periods.map((pRow, ri) => (
                            <tr key={pRow.period}>
                              {data.periods.map((pCol, ci) => {
                                const isDiag = ri === ci;
                                const val = isDiag ? cell.periods[ri] : 0;
                                const textColor = isDiag && val > 0
                                  ? (Math.sqrt(val / globalMax) > 0.5 ? "#fff" : "#333")
                                  : "transparent";
                                return (
                                  <td key={pCol.period} style={{
                                    width: `${100 / nPeriods}%`, height: 20,
                                    background: isDiag ? valColor(val, ri) : (isDiag ? "#f5f5f5" : "#fafafa"),
                                    border: isDiag ? `1px solid ${PERIOD_COLORS[ri]}40` : "1px solid #f0f0f0",
                                    textAlign: "center", fontSize: 8, fontWeight: isDiag && val > 0 ? 700 : 400,
                                    color: textColor,
                                  }}>
                                    {isDiag && val > 0 ? val.toLocaleString() : ""}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Tooltip */}
                      {isHovered && (
                        <div style={{
                          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                          background: "#333", color: "#fff", padding: "8px 12px", borderRadius: 6,
                          fontSize: 11, whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none",
                          marginBottom: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{cell.objectName} × {cell.solutionName}</div>
                          {data.periods.map((p, pi) => (
                            <div key={p.period} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                              <span>{p.label}:</span>
                              <span style={{ fontWeight: 600 }}>{cell.periods[pi].toLocaleString()}건</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 4, borderTop: "1px solid #555", paddingTop: 4, fontWeight: 700 }}>
                            합계: {cell.total.toLocaleString()}건
                          </div>
                          {tag && tagOpt && (
                            <div style={{ marginTop: 3, color: tagOpt.color, fontWeight: 600 }}>
                              {tagOpt.emoji} {tagOpt.label}: {tagOpt.desc}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function Stage3Page() {
  const stage = getStageBySlug("stage3")!;
  const [result, setResult] = useState<Stage3Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sankey" | "os" | "detail_os">("sankey");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/stage3-results", { cache: "no-store" });
      if (!res.ok) return;
      setResult(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);
  useEffect(() => {
    const hasPartial = result?.exists && result.dashboard && !result.hwpxReady;
    if (hasPartial && !pollingRef.current) pollingRef.current = setInterval(fetchResults, 5000);
    if (result?.hwpxReady && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [result?.exists, result?.hwpxReady, fetchResults]);

  if (loading) {
    return (<>
      <section className="s2-header">
        <div className="s2-header-eyebrow">{stage.eyebrow}</div>
        <h1 className="s2-header-title">{stage.title}</h1>
      </section>
      <div className="s2-loading">결과를 불러오는 중...</div>
      <StageNav currentNum={3} />
    </>);
  }

  if (!result?.dashboard) {
    return (<>
      <section className="s2-header">
        <div className="s2-header-eyebrow">{stage.eyebrow}</div>
        <h1 className="s2-header-title">{stage.title}</h1>
        <p className="s2-header-lead">{stage.lead}</p>
      </section>
      <section className="card mb-md">
        <div className="card-header"><h3>분석 실행 방법</h3></div>
        <div className="card-body">
          <div className="s2-empty-guide">
            <div className="s2-empty-icon">&#128300;</div>
            <h2 className="s2-empty-title">아직 정성분석 결과가 없습니다</h2>
            <p className="s2-empty-desc">Claude Code에서 <code>/patent-quality &lt;폴더&gt;</code> 실행</p>
            <button type="button" className="btn btn-sm mt-md" onClick={fetchResults}>새로고침</button>
          </div>
        </div>
      </section>
      <StageNav currentNum={3} />
    </>);
  }

  const { sankey, osMatrix } = result.dashboard;

  return (<>
    <section className="s2-header">
      <div className="s2-header-eyebrow">{stage.eyebrow}</div>
      <h1 className="s2-header-title">{stage.title}</h1>
      {result.folder && <p className="s2-header-folder"><span className="text-muted">데이터:</span> {result.folder}</p>}
    </section>

    {result.hwpxReady && (
      <div className="s2-complete-banner">
        <span className="s2-complete-icon">&#10003;</span>
        <div style={{ flex: 1 }}>
          <strong>Quality_report.hwpx 보고서가 생성되었습니다</strong>
          <div className="text-sm" style={{ opacity: 0.85 }}>{result.folder}\Quality_report.hwpx</div>
        </div>
        <a href="/api/stage3-download" className="btn btn-success s2-download-btn" download="Quality_report.hwpx">다운로드</a>
      </div>
    )}

    {/* Tabs */}
    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e0e0e0" }}>
      {([
        ["sankey", "기술흐름도", "#4A90D9"],
        ["os", "O/S Matrix (대분류)", "#E07070"],
        ["detail_os", "O/S Matrix (세부)", "#9B7BD4"],
      ] as const).map(([key, label, color]) => (
        <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
          style={{
            padding: "10px 24px", border: "none", cursor: "pointer", fontSize: 14,
            fontWeight: activeTab === key ? 700 : 400,
            background: activeTab === key ? "#fff" : "#f5f5f5",
            borderBottom: activeTab === key ? `3px solid ${color}` : "3px solid transparent",
            color: activeTab === key ? color : "#666",
            borderRadius: "6px 6px 0 0", transition: "all 0.15s",
          }}>
          {label}
        </button>
      ))}
    </div>

    <section className="card mb-md" style={{ borderTopLeftRadius: 0 }}>
      <div className="card-body" style={{ padding: 20 }}>
        {activeTab === "sankey" && (<>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>연도별 기술흐름도</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, fontSize: 12 }}>
            {sankey.themes.map((t, i) => (
              <span key={t.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: THEME_COLORS[i % THEME_COLORS.length], display: "inline-block" }} />
                {t.name}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>각 기술의 연도별 순위 변동을 추적합니다. 선 위에 마우스를 올리면 상세 정보를 확인할 수 있습니다.</p>
          <BumpChart data={sankey} />
        </>)}
        {activeTab === "os" && (<>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>O/S Matrix — 대분류 (해결과제 6 × 해결수단 6)</h3>
          <OSMatrix data={osMatrix} />
        </>)}
        {activeTab === "detail_os" && (<>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>O/S Matrix — 세부 (해결과제 14 × 해결수단 14)</h3>
          {result.dashboard.detailOsMatrix ? (
            <OSMatrix data={result.dashboard.detailOsMatrix} />
          ) : (
            <p className="text-muted">세부 카테고리가 정의되지 않았습니다. categories.json에 detail_object_categories / detail_solution_categories를 추가하세요.</p>
          )}
        </>)}
      </div>
    </section>

    {!result.hwpxReady && (
      <div className="s2-poll-row mb-md">
        <button type="button" className="btn btn-sm" onClick={fetchResults}>새로고침</button>
        <span className="text-sm text-muted">분석 진행 중에는 5초마다 자동 갱신됩니다</span>
      </div>
    )}
    <StageNav currentNum={3} />
  </>);
}
