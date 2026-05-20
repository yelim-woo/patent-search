"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { STAGES } from "@/lib/stages";

export default function Sidebar() {
  const pathname = usePathname();
  const match = pathname?.match(/\/stage(\d)/);
  const currentNum = match ? parseInt(match[1], 10) : 0;

  const [stage2Ready, setStage2Ready] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/stage2-results", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setStage2Ready(data.exists && data.charts?.length > 0);
      } catch { /* ignore */ }
    }
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar">
      <Link href="/stage1" className="brand">
        <span className="brand-mark">🔍</span>
        <span>
          IP Landscape
          <br />
          <small style={{ fontWeight: 400, color: "#94a3b8", fontSize: 11 }}>특허 분석 워크벤치</small>
        </span>
      </Link>

      <ul className="stepper">
        {STAGES.map((s) => {
          const isActive = s.num === currentNum;
          const isLocked = s.num === 2 && !stage2Ready;

          if (isLocked) {
            return (
              <li key={s.num} className="step-locked-wrap">
                <span className="step-locked">
                  <span className="step-num step-num-locked">{s.num}</span>
                  <span className="step-title step-title-locked">{s.num}. {s.title}</span>
                </span>
                <div className="step-tooltip">
                  /patent-trend 스킬을 실행해주세요
                </div>
              </li>
            );
          }

          return (
            <li key={s.num}>
              <Link href={s.href} className={isActive ? "is-active" : ""}>
                <span className="step-num">{s.num}</span>
                <span className="step-title">{s.num}. {s.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
