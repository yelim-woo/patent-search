import type { IpcCode, KeywordGroup, SmallNode } from "@/lib/prompts/stage1";

/**
 * 사용자가 키워드/IPC 편집 후 검색식을 자동 재조립.
 * AI 원본의 도메인 AND 부분 ("(로봇 OR robot* OR manipulat*)" 같은)을 유지하고,
 * 키워드 OR 부분만 사용자가 편집한 keywordGroups에서 새로 조립합니다.
 */

// ──────────────────────────────────────────────────────────────
// 키워드 그룹 → OR 키워드 배열 (중복 제거 + 따옴표 처리)
// ──────────────────────────────────────────────────────────────

function pushKeyword(target: string[], seen: Set<string>, raw: string, isEnglish: boolean) {
  const v = raw.trim();
  if (!v) return;
  const norm = v.toLowerCase();
  if (seen.has(norm)) return;
  seen.add(norm);
  // 영어 다단어는 따옴표 처리
  target.push(isEnglish && v.includes(" ") ? `"${v}"` : v);
}

/** 모든 그룹 키워드를 단일 배열로 (호환용 — 기존 호출처 유지). */
export function collectKeywords(groups: KeywordGroup[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    if (g.type === "exclude") continue; // include만
    for (const k of g.ko) pushKeyword(out, seen, k, false);
    for (const k of g.en) pushKeyword(out, seen, k, true);
  }
  return out;
}

/** include / exclude 분리 수집. exclude 그룹의 키워드는 NOT 절로 결합됨. */
export function collectKeywordsByType(groups: KeywordGroup[]): {
  include: string[];
  exclude: string[];
} {
  const include: string[] = [];
  const exclude: string[] = [];
  const seenInc = new Set<string>();
  const seenExc = new Set<string>();
  for (const g of groups) {
    const isExclude = g.type === "exclude";
    const target = isExclude ? exclude : include;
    const seen = isExclude ? seenExc : seenInc;
    for (const k of g.ko) pushKeyword(target, seen, k, false);
    for (const k of g.en) pushKeyword(target, seen, k, true);
  }
  return { include, exclude };
}

// ──────────────────────────────────────────────────────────────
// AI 원본 검색식에서 도메인 AND 부분 추출
//
// 예시 입력: TIAB=((강화학습 OR DRL OR ...) AND (로봇 OR robot* OR manipulat*))
// 추출 결과: (로봇 OR robot* OR manipulat*)
//
// 추출 실패 시 fallback: (로봇 OR robot*)
// ──────────────────────────────────────────────────────────────

export function extractDomainAnd(basicQuery: string | undefined): string {
  if (!basicQuery) return "";
  // TIAB=(...) 안에서 가장 바깥 괄호 안의 내용 추출
  const tiabMatch = basicQuery.match(/TIAB\s*=\s*\(([\s\S]+)\)\s*$/);
  if (!tiabMatch) return "";
  let inner = tiabMatch[1].trim();
  // 가장 바깥에 추가 괄호가 있으면 한 번 더 벗기기
  if (inner.startsWith("(") && inner.endsWith(")")) {
    // 균형 맞는 경우에만
    if (isBalanced(inner.slice(1, -1))) {
      inner = inner.slice(1, -1).trim();
    }
  }
  // " AND " 로 분리 — 단, 괄호 안의 AND는 무시 (간단한 깊이 계산)
  const andIdx = findTopLevelAndAfterParenGroup(inner);
  if (andIdx < 0) return "";
  const domainPart = inner.slice(andIdx + 5).trim();
  if (!domainPart.startsWith("(")) {
    // 괄호로 시작 안 하면 감싸기
    return `(${domainPart})`;
  }
  return domainPart;
}

function isBalanced(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * 첫 괄호 그룹 (...) 뒤에 나오는 " AND " 위치 반환. 없으면 -1.
 */
function findTopLevelAndAfterParenGroup(s: string): number {
  let depth = 0;
  let firstParenEnded = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0 && !firstParenEnded) {
        firstParenEnded = true;
      }
    }
    if (firstParenEnded && depth === 0) {
      // 이 위치 이후 " AND " 찾기
      const tail = s.slice(i + 1);
      const andMatch = tail.match(/^\s+AND\s+/i);
      if (andMatch) {
        return i + 1 + andMatch[0].length - 5; // " AND ".length === 5
      }
    }
  }
  return -1;
}

// ──────────────────────────────────────────────────────────────
// IPC 코드 정규화: "B25J 9/16" → "B25J9/16"
// ──────────────────────────────────────────────────────────────

export function normalizeIpcForQuery(code: string): string {
  return code.replace(/\s+/g, "");
}

// ──────────────────────────────────────────────────────────────
// basic / precise 자동 재조립
// ──────────────────────────────────────────────────────────────

export type RebuildContext = {
  /** AI 원본 노드 (도메인 AND 추출용) */
  aiOriginal?: SmallNode;
};

export function rebuildBasic(
  node: Pick<SmallNode, "keywordGroups">,
  ctx: RebuildContext
): string {
  const { include, exclude } = collectKeywordsByType(node.keywordGroups);
  const domain = extractDomainAnd(ctx.aiOriginal?.queries.basic);

  // include 키워드가 없으면 AI 원본 검색식 유지
  if (include.length === 0) {
    return ctx.aiOriginal?.queries.basic ?? "";
  }

  // 도메인 추출 실패 시 키워드만으로 구성
  let inner = domain
    ? `(${include.join(" OR ")}) AND ${domain}`
    : `(${include.join(" OR ")})`;
  if (exclude.length > 0) {
    inner += ` NOT (${exclude.join(" OR ")})`;
  }
  return `TIAB=(${inner})`;
}

export function rebuildPrecise(
  node: Pick<SmallNode, "keywordGroups" | "ipcCodes">,
  ctx: RebuildContext
): string {
  const basic = rebuildBasic(node, ctx);
  if (node.ipcCodes.length === 0) return basic;
  const ipcPart = node.ipcCodes.map((i: IpcCode) => normalizeIpcForQuery(i.code)).join(" OR ");
  return `${basic} AND IPC=(${ipcPart})`;
}

/**
 * 노드 전체 재조립 — 검색식만 갱신, 다른 필드는 그대로.
 */
export function rebuildNode(
  node: SmallNode,
  aiOriginal: SmallNode | undefined
): SmallNode {
  const ctx: RebuildContext = { aiOriginal };
  return {
    ...node,
    queries: {
      basic: rebuildBasic(node, ctx),
      precise: rebuildPrecise(node, ctx),
    },
  };
}
