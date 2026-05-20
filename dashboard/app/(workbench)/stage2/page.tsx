"use client";

import { useEffect, useRef, useState } from "react";
import StageNav from "@/components/StageNav";
import { getStageBySlug } from "@/lib/stages";

type ChartBullets = {
  chart_id: number;
  subtitle: string;
  caption: string;
  bullets: string[];
};

type ChartData = {
  id: number;
  image: string | null;
  stats: Record<string, unknown> | null;
  bullets: ChartBullets | null;
};

type Stage2Result = {
  exists: boolean;
  folder: string | null;
  charts: ChartData[];
  hwpxReady: boolean;
};

const CHART_META: Record<number, { chapter: number; figNum: string; title: string }> = {
  1: { chapter: 3, figNum: "3-1", title: "주요 국가별 연도별 출원동향" },
  2: { chapter: 3, figNum: "3-2", title: "국가별 특허 점유 현황" },
  3: { chapter: 3, figNum: "3-3", title: "IPC 기술 분야 분포 Top 10" },
  4: { chapter: 3, figNum: "3-4", title: "주요 IPC 연도별 동향" },
  6: { chapter: 3, figNum: "3-5", title: "국가별 등록률 분석" },
  7: { chapter: 3, figNum: "3-6", title: "기술 성장단계 (S-curve)" },
  5: { chapter: 4, figNum: "4-1", title: "주요 출원인 Top 15" },
  8: { chapter: 4, figNum: "4-2", title: "출원인 연도별 활동 추이" },
  9: { chapter: 4, figNum: "4-3", title: "출원인-국가 히트맵" },
  10: { chapter: 4, figNum: "4-4", title: "출원인 유형 분포" },
};

const CH3_ORDER = [1, 2, 3, 4, 6, 7];
const CH4_ORDER = [5, 8, 9, 10];

export default function Stage2Page() {
  const stage = getStageBySlug("stage2")!;
  const [result, setResult] = useState<Stage2Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChart, setExpandedChart] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchResults() {
    try {
      const res = await fetch("/api/stage2-results", { cache: "no-store" });
      if (!res.ok) return;
      const data: Stage2Result = await res.json();
      setResult(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchResults();
  }, []);

  // Auto-poll while analysis is in progress (has some charts but not complete)
  useEffect(() => {
    const hasPartial = result?.exists && result.charts.length > 0 && !result.hwpxReady;
    if (hasPartial && !pollingRef.current) {
      pollingRef.current = setInterval(fetchResults, 5000);
    }
    if (result?.hwpxReady && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [result?.exists, result?.charts.length, result?.hwpxReady]);

  const hasCharts = result?.exists && result.charts.length > 0;
  const ch3Charts = hasCharts ? result!.charts.filter((c) => CH3_ORDER.includes(c.id)) : [];
  const ch4Charts = hasCharts ? result!.charts.filter((c) => CH4_ORDER.includes(c.id)) : [];
  ch3Charts.sort((a, b) => CH3_ORDER.indexOf(a.id) - CH3_ORDER.indexOf(b.id));
  ch4Charts.sort((a, b) => CH4_ORDER.indexOf(a.id) - CH4_ORDER.indexOf(b.id));

  const totalCharts = (result?.charts ?? []).filter((c) => c.image).length;
  const totalBullets = (result?.charts ?? []).filter((c) => c.bullets).length;

  if (loading) {
    return (
      <>
        <section className="s2-header">
          <div className="s2-header-eyebrow">{stage.eyebrow}</div>
          <h1 className="s2-header-title">{stage.title}</h1>
        </section>
        <div className="s2-loading">결과를 불러오는 중...</div>
        <StageNav currentNum={2} />
      </>
    );
  }

  // No results yet — show guide
  if (!hasCharts) {
    return (
      <>
        <section className="s2-header">
          <div className="s2-header-eyebrow">{stage.eyebrow}</div>
          <h1 className="s2-header-title">{stage.title}</h1>
          <p className="s2-header-lead">{stage.lead}</p>
        </section>

        <section className="card mb-md">
          <div className="card-header">
            <h3>분석 실행 방법</h3>
          </div>
          <div className="card-body">
            <div className="s2-empty-guide">
              <div className="s2-empty-icon">&#128202;</div>
              <h2 className="s2-empty-title">아직 분석 결과가 없습니다</h2>
              <p className="s2-empty-desc">
                Stage 1에서 설계한 검색식으로 WIPS ON에서 특허 데이터를 다운로드한 후,<br />
                Claude Code에서 아래 명령을 실행하세요.
              </p>
              <code className="s2-cmd s2-cmd-lg">/patent-trend &lt;엑셀 폴더 경로&gt;</code>
              <div className="s2-empty-steps">
                <div className="s2-empty-step">
                  <span className="s2-empty-step-num">1</span>
                  <span>WIPS ON에서 특허 검색 후 엑셀(.xlsx) 다운로드</span>
                </div>
                <div className="s2-empty-step">
                  <span className="s2-empty-step-num">2</span>
                  <span>Claude Code 터미널에서 <code>/patent-trend C:\데이터폴더</code> 실행</span>
                </div>
                <div className="s2-empty-step">
                  <span className="s2-empty-step-num">3</span>
                  <span>분석 완료 후 이 페이지에 자동 반영</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm mt-md"
                onClick={fetchResults}
              >
                새로고침
              </button>
            </div>
          </div>
        </section>

        <StageNav currentNum={2} />
        <span style={{ display: "none" }} aria-hidden="true">{stage.title}</span>
      </>
    );
  }

  // Results exist — show charts
  return (
    <>
      <section className="s2-header">
        <div className="s2-header-eyebrow">{stage.eyebrow}</div>
        <h1 className="s2-header-title">{stage.title}</h1>
        {result?.folder && (
          <p className="s2-header-folder">
            <span className="text-muted">데이터:</span> {result.folder}
          </p>
        )}
      </section>

      {/* Progress bar */}
      <section className="card mb-md">
        <div className="card-body">
          <div className="s2-steps">
            <div className="s2-step">
              <div className="s2-step-num">A</div>
              <div>
                <div className="s2-step-title">차트 생성</div>
                <div className="s2-step-desc">10개 차트 PNG + 통계 JSON</div>
              </div>
              <div className={`s2-step-badge ${totalCharts > 0 ? "is-done" : ""}`}>
                {totalCharts > 0 ? `${totalCharts}/10` : "대기"}
              </div>
            </div>
            <div className="s2-step">
              <div className="s2-step-num">B</div>
              <div>
                <div className="s2-step-title">분석 해석</div>
                <div className="s2-step-desc">차트별 불릿 문장 작성</div>
              </div>
              <div className={`s2-step-badge ${totalBullets > 0 ? "is-done" : ""}`}>
                {totalBullets > 0 ? `${totalBullets}/10` : "대기"}
              </div>
            </div>
            <div className="s2-step">
              <div className="s2-step-num">C</div>
              <div>
                <div className="s2-step-title">HWPX 보고서</div>
                <div className="s2-step-desc">한글 보고서 조립</div>
              </div>
              <div className={`s2-step-badge ${result?.hwpxReady ? "is-done" : ""}`}>
                {result?.hwpxReady ? "완료" : "대기"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Report complete banner */}
      {result?.hwpxReady && (
        <div className="s2-complete-banner">
          <span className="s2-complete-icon">&#10003;</span>
          <div style={{ flex: 1 }}>
            <strong>Trend_report.hwpx 보고서가 생성되었습니다</strong>
            <div className="text-sm" style={{ opacity: 0.85 }}>
              {result.folder}\Trend_report.hwpx
            </div>
          </div>
          <a
            href="/api/stage2-download"
            className="btn btn-success s2-download-btn"
            download="Trend_report.hwpx"
          >
            다운로드
          </a>
        </div>
      )}

      {/* Charts - Chapter 3 */}
      {ch3Charts.length > 0 && (
        <section className="card mb-md">
          <div className="card-header">
            <h3>Chapter 3. 출원동향 분석</h3>
            <span className="text-sm text-muted">{ch3Charts.length}개 차트</span>
          </div>
          <div className="card-body s2-chart-grid">
            {ch3Charts.map((chart) => (
              <ChartCard
                key={chart.id}
                chart={chart}
                meta={CHART_META[chart.id]}
                expanded={expandedChart === chart.id}
                onToggle={() => setExpandedChart(expandedChart === chart.id ? null : chart.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Charts - Chapter 4 */}
      {ch4Charts.length > 0 && (
        <section className="card mb-md">
          <div className="card-header">
            <h3>Chapter 4. 출원인 분석</h3>
            <span className="text-sm text-muted">{ch4Charts.length}개 차트</span>
          </div>
          <div className="card-body s2-chart-grid">
            {ch4Charts.map((chart) => (
              <ChartCard
                key={chart.id}
                chart={chart}
                meta={CHART_META[chart.id]}
                expanded={expandedChart === chart.id}
                onToggle={() => setExpandedChart(expandedChart === chart.id ? null : chart.id)}
              />
            ))}
          </div>
        </section>
      )}

      {!result?.hwpxReady && (
        <div className="s2-poll-row mb-md">
          <button type="button" className="btn btn-sm" onClick={fetchResults}>
            새로고침
          </button>
          <span className="text-sm text-muted">분석 진행 중에는 5초마다 자동 갱신됩니다</span>
        </div>
      )}

      <StageNav currentNum={2} />
      <span style={{ display: "none" }} aria-hidden="true">{stage.title}</span>
    </>
  );
}

function ChartCard({
  chart,
  meta,
  expanded,
  onToggle,
}: {
  chart: ChartData;
  meta: { chapter: number; figNum: string; title: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!expanded) {
    // Collapsed: thumbnail card
    return (
      <div className="s2-chart-card s2-chart-card-thumb" onClick={onToggle}>
        <div className="s2-thumb-label">
          <span className="s2-chart-fig">&lt;그림 {meta.figNum}&gt;</span>
          <span className="s2-thumb-title">{meta.title}</span>
        </div>
        {chart.image && (
          <div className="s2-thumb-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chart.image} alt={meta.title} className="s2-thumb-img" />
          </div>
        )}
      </div>
    );
  }

  // Expanded: full-width detail
  return (
    <div className="s2-chart-card is-expanded">
      <div className="s2-chart-card-header" onClick={onToggle}>
        <span className="s2-chart-fig">&lt;그림 {meta.figNum}&gt;</span>
        <span className="s2-chart-title">{meta.title}</span>
        <span className="s2-chart-toggle">▴ 접기</span>
      </div>

      {chart.image && (
        <div className="s2-chart-img-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chart.image} alt={meta.title} className="s2-chart-img" />
        </div>
      )}

      {chart.bullets && (
        <div className="s2-chart-bullets">
          {chart.bullets.bullets.map((b, i) => (
            <p key={i} className="s2-bullet">{b}</p>
          ))}
        </div>
      )}

      {!chart.bullets && (
        <div className="s2-chart-bullets s2-chart-bullets-empty">
          <p className="text-muted">분석 해석 대기 중 (Stage B)</p>
        </div>
      )}
    </div>
  );
}
