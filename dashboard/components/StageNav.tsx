"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STAGES, getStageByNum } from "@/lib/stages";

type Props = {
  currentNum: number;
};

export default function StageNav({ currentNum }: Props) {
  const prev = getStageByNum(currentNum - 1);
  const next = getStageByNum(currentNum + 1);
  const isLast = currentNum === STAGES.length;

  const [stage2Ready, setStage2Ready] = useState(false);

  useEffect(() => {
    if (next?.num !== 2) return;
    async function check() {
      try {
        const res = await fetch("/api/stage2-results", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setStage2Ready(data.exists && data.charts?.length > 0);
      } catch { /* ignore */ }
    }
    check();
  }, [next?.num]);

  const nextLocked = next?.num === 2 && !stage2Ready;

  return (
    <nav className="stage-nav">
      <div>
        {prev && prev.implemented && (
          <Link href={prev.href} className="btn">
            ◀ 이전: {prev.num}. {prev.title}
          </Link>
        )}
      </div>
      <div className="right">
        {next ? (
          next.implemented ? (
            nextLocked ? (
              <span className="stage-nav-locked-wrap">
                <button
                  type="button"
                  className="btn"
                  disabled
                  style={{ cursor: "not-allowed", opacity: 0.5 }}
                >
                  다음: {next.num}. {next.title} ▶
                </button>
                <span className="stage-nav-tooltip">
                  /patent-trend 스킬을 실행해주세요
                </span>
              </span>
            ) : (
              <Link href={next.href} className="btn btn-primary">
                다음: {next.num}. {next.title} ▶
              </Link>
            )
          ) : (
            <button
              type="button"
              className="btn"
              disabled
              title="아직 구현되지 않은 단계입니다"
              style={{ cursor: "not-allowed", opacity: 0.5 }}
            >
              다음: {next.num}. {next.title} (준비 중)
            </button>
          )
        ) : !isLast ? null : (
          <Link href="/" className="btn btn-success">
            ✓ 완료
          </Link>
        )}
      </div>
    </nav>
  );
}
