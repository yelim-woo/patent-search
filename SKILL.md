---
description: 연구 주제를 입력받아 WIPS ON 특허 검색식을 설계하고, 웹 UI에서 결과를 확인/편집할 수 있게 합니다. Stage 2에서는 특허 엑셀 데이터로 동향분석 HWPX 보고서를 생성합니다.
user-invocable: true
arguments: 연구 주제 또는 특허 데이터 폴더 경로
---

# patent-search

연구 주제를 입력받아 특허 검색식을 설계하고, 웹 UI에서 결과를 확인/편집할 수 있게 합니다.

---

## 실행 흐름

**중요: 아래 규칙을 반드시 지키세요.**
- 1→2→3 단계를 사용자 확인 없이 연속으로 실행하세요. 중간에 멈추거나 "진행할까요?" 같은 질문을 하지 마세요.
- frontmatter 점검, npm install 여부, Python 패키지 확인 등을 사용자에게 질문하지 마세요. 모든 의존성은 스크립트가 자동 처리합니다.
- 사용자에게는 검색식 생성 결과와 대시보드 URL만 안내하세요.

사용자가 연구 주제를 입력하면:

1. **검색식 설계**: 아래 지침에 따라 JSON 결과를 직접 생성
2. **파일 저장**: 생성 즉시 `${CLAUDE_SKILL_DIR}/dashboard/public/stage1-results/YYYYMMDD_HHmm_주제요약.json` 으로 저장
3. **웹 실행**: 저장 즉시 Next.js 서버를 띄우고 브라우저 URL 안내

## Stage 1 — 검색식 설계 지침

당신은 정부출연연구기관 연구담당자를 돕는 특허 정보 분석 전문가입니다.
검색식은 **WIPS ON** (https://www.wipson.com/) 신택스로 작성합니다.

### 산출물 구조

반드시 아래 JSON 구조를 따르세요:

```json
{
  "category": "대분류 > 중분류",
  "globalKeywords": {
    "core": ["핵심키워드1", "핵심키워드2"],
    "exclude": ["제외키워드1"]
  },
  "taxonomy": [
    {
      "id": "A",
      "name": "대분류명",
      "scope": "범위 한 줄",
      "estimatedHits": 5000,
      "children": [
        {
          "id": "A.1",
          "name": "중분류명",
          "scope": "범위 한 줄",
          "estimatedHits": 2000,
          "children": [
            {
              "id": "A.1.1",
              "name": "소분류명",
              "scope": "범위 한 줄",
              "keywordGroups": [
                {
                  "label": "그룹명",
                  "type": "include",
                  "ko": ["한국어키워드1"],
                  "en": ["english keyword1"]
                }
              ],
              "ipcCodes": [
                { "code": "B25J", "desc": "설명" }
              ],
              "queries": {
                "basic": "TIAB=((키워드 OR ...) AND (도메인))",
                "precise": "TIAB=(...) AND IPC=(...)"
              },
              "estimatedHits": 500
            }
          ]
        }
      ]
    }
  ],
  "unifiedQuery": {
    "basic": "통합 기본 검색식",
    "precise": "통합 정밀 검색식"
  },
  "searchTips": ["팁1", "팁2"]
}
```

### 핵심 규칙

- **대분류 3~4개 / 중분류 2~3개 / 소분류 2~3개** (총 15~25 소분류)
- **대/중분류는 헤더만** (id, name, scope, estimatedHits, children)
- **검색식·키워드·IPC는 소분류에서만** 작성
- **IPC 코드는 서브클래스 단위(4자리)로만 작성** (예: `B25J`, `A61B`). 와일드카드(`*`)나 풀 코드(`B25J 9/16`)는 사용 금지
- 키워드 그룹: 단일 개념의 변형/동의어를 풍부하게 (그룹당 8~15개)
- 통합 검색식 ≠ 모든 소분류 OR → 분야 대표 키워드 8~15개만
- 검색 누락이 노이즈보다 위험 → 동의어/변형 풍부하게

### WIPS ON 신택스

- `TIAB=(...)`: 제목+초록
- `IPC=(...)`: IPC 분류
- AND, OR, NOT (대문자)
- 한국어: 따옴표 없이, 영어 구문: 따옴표로 묶음, 와일드카드: `*`

### 키워드 그룹 type

- **include**: 검색에 포함 (OR 결합)
- **exclude**: 노이즈 제거 (NOT 결합), 노드당 0~1개

## 파일 저장 규칙

- 경로: `${CLAUDE_SKILL_DIR}/dashboard/public/stage1-results/YYYYMMDD_HHmm_주제요약.json`
- 주제요약: 사용자 입력에서 핵심 키워드 2~3개를 언더스코어로 연결 (예: `휴머노이드_로봇`)
- 예시: `20260518_1430_휴머노이드_로봇.json`
- 폴더가 없으면 생성

## 웹 대시보드 실행

포트 충돌을 방지하기 위해 빈 포트를 자동으로 찾아 사용한다.

```bash
cd "${CLAUDE_SKILL_DIR}/dashboard"
if [ ! -d node_modules ]; then
  npm install --silent 2>/dev/null
fi
PORT=3000
while lsof -i :$PORT >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$PORT "; do
  PORT=$((PORT + 1))
done
npx next dev --hostname 0.0.0.0 --port $PORT &
```

서버가 준비되면 **실제 사용된 포트 번호**를 포함하여 안내:

> 검색식 설계가 완료되었습니다.
> 브라우저에서 http://localhost:$PORT/stage1 을 열면 결과를 확인/편집할 수 있습니다.

## 종료

사용된 포트 번호로 종료한다:

```bash
npx kill-port $PORT
```

**주의**: `taskkill //F //IM node.exe` 절대 사용 금지. Claude Code가 함께 종료됩니다.
