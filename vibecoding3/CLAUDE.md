# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

상식 퀴즈 게임(화면 타이틀 'QUIZ SHOW'). 순수 HTML/CSS/JavaScript이고 빌드 도구나 서버가 없다. `index.html`을 브라우저로 열면 바로 실행된다.

- 기준 문서는 `상식 퀴즈 게임PRD.md`다. 기능이나 디자인을 바꾸면 PRD도 함께 고친다.
- 파일: `index.html`(화면 5개를 `section`으로 전환), `style.css`, `questions.js`(`QUESTIONS`, `CATEGORIES`), `app.js`(게임 로직).
- 타이틀 간판은 `index.html` 안의 인라인 SVG다. 전구 위치는 계산해서 만든 값이라 손으로 하나씩 고치지 말고 모양 전체를 다시 생성한다.

## Repository layout

- The git root is the parent directory (`../`), not this folder. That repo holds several independent exercise projects side by side (`vibecoding1/`, `vibecoding2/`, `vibecoding3/`), and each one is self-contained.
- Don't read or change the sibling projects unless asked. Each has its own `CLAUDE.md` or `PRD.md`, and their rules apply only inside their own folder.
- Commit messages in this repo are written in Korean, as short one-line summaries of the change (for example, `데스크톱 좁은 폭에서 하단 버튼 글자 꺾임 수정`).

## 퀴즈 문제 교차검증 규칙 (questions.js를 추가·수정할 때 항상 적용)

### 1. 출처 원칙
- 모델의 기억은 출처가 아니다. 모든 사실은 서로 독립적인 출처 2곳 이상에서 확인한다.
- 출처 우선순위: 교과서·공공기관(국사편찬위원회 우리역사넷, 국립국어원, 문화재청, NASA, USGS 등)
  > 백과사전(한국민족문화대백과, 브리태니커, 두산백과) > 그 밖의 웹 문서.
  블로그·커뮤니티·AI가 만든 글은 출처로 쓰지 않는다.
- 두 출처가 서로 다르면 그 문제는 쓰지 않거나, 표현을 고쳐 다툼이 없는 사실만 묻는다.

### 2. 문제마다 확인할 것
- [ ] 정답이 사실인가 (출처 2곳 이상)
- [ ] 정답이 하나뿐인가: 오답 보기 3개가 '부분적으로 맞는' 경우가 없는가
- [ ] 질문만 읽고 답이 하나로 정해지는가 (기준이 애매하지 않은가)
- [ ] 해설에 나오는 연도·숫자·인물이 출처와 정확히 같은가
- [ ] 시점에 따라 바뀌는 사실(인구, 순위, 현직자, 기록 보유자)이 아닌가
- [ ] 한국사: year 필드가 해설 속 사건 연도와 같은가 (시대순 정렬에 쓰임)

### 3. 특히 조심할 표현 (발견하면 반드시 다시 확인)
- 최상급·유일성: "최초", "가장 큰/긴/높은", "유일한" → 기준을 질문에 밝힌다
  (예: "현존하는", "남한에서", "대륙으로 분류되는 오스트레일리아를 제외하고")
- 정밀한 숫자: 높이·길이·면적 → 측정 기관마다 다르면 "약"을 붙이고 반올림한다
- 비슷한 연도 혼동: 창제와 반포(훈민정음 1443/1446), 착공과 완공, 발표와 출판
- 업적을 누구에게 돌릴지 논쟁이 있는 경우: 발견·발명의 공동 기여자, 학설 대립
- 정의에 따라 답이 바뀌는 문제: 세계에서 가장 긴 강(나일 vs 아마존), 가장 큰 사막(남극 포함 여부),
  무지개 색 개수 → 이런 문제는 출제하지 않는다

### 4. 작업 순서
1. 초안 작성
2. 위 체크리스트로 스스로 점검
3. 웹 검색으로 출처 2곳을 확인하고 URL을 남긴다
4. 검증 기록에 남긴다 (`questions-verification.md`: id | 확인한 주장 | 출처1 | 출처2 | 확인일 | 판정)
5. 확인이 안 되거나 출처끼리 다르면: 추측으로 고치지 말고 문제를 교체하거나 사용자에게 묻는다
6. `validateQuestions()` 통과 확인 후 결과를 보고한다

### 5. 보고 형식
- 검증한 문제 수, 통과·수정·교체한 문제 목록을 표로 보고한다.
- "확인했다"고 쓰려면 실제로 열어 본 출처가 있어야 한다. 출처 없이 기억으로 판단한 항목은
  "미검증"으로 따로 표시한다.
