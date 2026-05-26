export type Stage = {
  num: number;
  slug: string;
  title: string;
  href: string;
  eyebrow: string;
  lead: string;
  roles: { ai: string; user: string };
  implemented: boolean;
};

export const STAGES: Stage[] = [
  {
    num: 1,
    slug: "stage1",
    title: "검색식 설계",
    href: "/stage1",
    eyebrow: "STAGE 1 · Search Query Design",
    lead: "연구 주제를 자연어로 입력하면 AI가 키워드 맵·IPC/CPC 코드·DB별 Boolean 검색식을 자동 생성합니다.",
    roles: {
      ai: "🤖 AI: 검색식 생성, 키워드 확장, 코드 매칭",
      user: "👤 사용자: 기술 범위 확정, 검색식 최종 승인",
    },
    implemented: true,
  },
  {
    num: 2,
    slug: "stage2",
    title: "동향분석 보고서",
    href: "/stage2",
    eyebrow: "STAGE 2 · Trend Analysis Report",
    lead: "WIPS ON에서 다운로드한 특허 엑셀 데이터를 분석하여 10개 차트와 해석이 포함된 HWPX 보고서를 자동 생성합니다.",
    roles: {
      ai: "🤖 AI: 데이터 분석, 차트 생성, 해석 문장 작성, HWPX 조립",
      user: "👤 사용자: 엑셀 데이터 준비, 폴더 경로 지정, 보고서 확인",
    },
    implemented: true,
  },
  {
    num: 3,
    slug: "stage3",
    title: "정성분석 보고서",
    href: "/stage3",
    eyebrow: "STAGE 3 · Qualitative Analysis Report",
    lead: "요약·해결과제·해결수단 텍스트를 분석하여 기술흐름도와 O/S Matrix가 포함된 HWPX 보고서를 자동 생성합니다.",
    roles: {
      ai: "🤖 AI: 기술 주제 분류, O/S 카테고리 정의, 차트 생성, HWPX 조립",
      user: "👤 사용자: 엑셀 데이터 준비, 폴더 경로 지정, 카테고리 검증",
    },
    implemented: true,
  },
];

export function getStageBySlug(slug: string): Stage | undefined {
  return STAGES.find((s) => s.slug === slug);
}

export function getStageByNum(num: number): Stage | undefined {
  return STAGES.find((s) => s.num === num);
}
