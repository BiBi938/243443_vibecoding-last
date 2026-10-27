const SCREENS = ["start", "quiz", "result", "wrong", "ranking"];
const NAV_SCREENS = ["start", "wrong", "ranking"];
const QUESTIONS_PER_CATEGORY = 10;
const CHOICES_PER_QUESTION = 4;
const RECORDS_KEY = "quiz-records-v2"; // 점수 규칙이 바뀌어 예전 기록(quiz-records)과 따로 저장한다
const WRONG_KEY = "quiz-wrong";
const RANKING_SIZE = 10;
const TRANSITION_MS = 1500;
const TIMER_TICK_MS = 100;

// 점수 규칙: 정답만 득점. 기본 10점 × 난이도 배수 + 보너스
const BASE_POINTS = 10;
const DIFFICULTIES = {
  easy: { label: "EASY", multiplier: 1 },
  medium: { label: "MEDIUM", multiplier: 1.5 },
  hard: { label: "HARD", multiplier: 2 }
};
const TIME_LIMIT_MS = 15000;  // 모든 모드 문제당 제한 시간. 넘기면 시간 초과 오답
const FAST_ANSWER_MS = 10000; // 이보다 빨리 맞히면 시간 보너스
const FAST_BONUS = 3;
const NO_HINT_BONUS = 2;
const COMBO_BONUS = { 3: 2, 5: 5, 10: 10 }; // 연속 정답 수에 도달한 그 문제에서 한 번씩
const HINT_REMOVE = 2;                      // 힌트(50:50)로 지우는 오답 수

// 게임 모드. 순위표는 모드마다 따로 둔다. (틀린 문제 복습 "review"는 기록하지 않음)
const MODES = {
  all: { name: "ALL CHALLENGE", label: "전체도전", rule: "4과목 40문제를 끝까지 푼 도전자만 오를 수 있어요!" },
  category: { name: "CATEGORY", label: "카테고리별", rule: "한 과목 10문제를 끝까지 푼 기록이 과목 이름과 함께 올라요!" },
  speed: { name: "SPEED QUIZ", label: "스피드퀴즈", rule: "4과목을 섞은 20문제를 끝까지 버틴 기록만 올라요!" }
};
const SPEED_QUESTIONS = 20;
const TIMEOUT = -1; // picked 값: 시간 초과

const el = {
  navTabs: [...document.querySelectorAll("#app-nav .nav-tab")],
  nav: document.getElementById("app-nav"),
  wrongBadge: document.getElementById("wrong-badge"),
  startTitle: document.getElementById("start-title"),
  startError: document.getElementById("start-error"),
  subjectButtons: document.getElementById("subject-buttons"),
  allStartButton: document.getElementById("all-start-button"),
  speedStartButton: document.getElementById("speed-start-button"),
  subjectTabs: document.getElementById("subject-tabs"),
  sign: document.getElementById("quiz-sign"),
  category: document.getElementById("quiz-category"),
  difficulty: document.getElementById("quiz-difficulty"),
  counter: document.getElementById("quiz-counter"),
  combo: document.getElementById("quiz-combo"),
  score: document.getElementById("quiz-score"),
  progress: document.querySelector("#screen-quiz .progress"),
  progressBar: document.getElementById("quiz-progress-bar"),
  transition: document.getElementById("quiz-transition"),
  transitionText: document.getElementById("quiz-transition-text"),
  quizBody: document.getElementById("quiz-body"),
  question: document.getElementById("quiz-question"),
  hintButton: document.getElementById("hint-button"),
  timeGauge: document.getElementById("quiz-time"),
  timeBar: document.getElementById("quiz-time-bar"),
  choices: [...document.querySelectorAll("#quiz-choices .choice")],
  feedback: document.getElementById("quiz-feedback"),
  feedbackText: document.getElementById("quiz-feedback-text"),
  points: document.getElementById("quiz-points"),
  explanation: document.getElementById("quiz-explanation"),
  nextButton: document.getElementById("next-button"),
  quitButton: document.getElementById("quit-button"),
  resultTitle: document.getElementById("result-title"),
  resultScore: document.getElementById("result-score"),
  resultPercent: document.getElementById("result-percent"),
  resultCategories: document.getElementById("result-categories"),
  resultBreakdown: document.getElementById("result-breakdown"),
  resultTime: document.getElementById("result-time"),
  resultRank: document.getElementById("result-rank"),
  wrongNoteSummary: document.getElementById("wrong-note-summary"),
  wrongNoteList: document.getElementById("wrong-note-list"),
  retryButton: document.getElementById("retry-button"),
  resultWrongButton: document.getElementById("result-wrong-button"),
  resultRankingButton: document.getElementById("result-ranking-button"),
  wrongTitle: document.getElementById("wrong-title"),
  wrongEmpty: document.getElementById("wrong-empty"),
  wrongList: document.getElementById("wrong-list"),
  wrongRetryButton: document.getElementById("wrong-retry-button"),
  wrongClearButton: document.getElementById("wrong-clear-button"),
  rankingTitle: document.getElementById("ranking-title"),
  rankingTabs: document.getElementById("ranking-tabs"),
  rankingRule: document.getElementById("ranking-rule"),
  rankingHead: document.getElementById("ranking-head"),
  rankingBody: document.getElementById("ranking-body"),
  rankingNote: document.getElementById("ranking-note"),
  homeButton: document.getElementById("home-button"),
  resetButton: document.getElementById("reset-button")
};

// 게임 진행 상태 (메모리, 저장 안 함)
const state = {
  mode: null,         // "all"(전체도전) | "category"(카테고리별) | "speed"(스피드퀴즈) | "review"(틀린 문제)
  category: null,     // 카테고리별 모드에서 고른 과목
  sessions: [],       // 과목 탭마다 따로 진행. 항목은 newSession() 참고
  current: 0,         // 지금 보고 있는 세션
  categoryScores: {}, // 카테고리별 맞힌 수
  categoryTotals: {}, // 카테고리별 푼 문제 수 (결과 계산 때 채움)
  combo: 0,           // 지금 이어지고 있는 연속 정답 수 (탭을 오가도 답한 순서대로 셈)
  maxCombo: 0,
  breakdown: { base: 0, fast: 0, noHint: 0, combo: 0 }, // 항목별 득점 합계
  startedAt: null,    // Date.now()
  endedAt: null,      // 마지막 문제에 답한 시각 (그만두면 그만둔 시각)
  quit: false,        // 중간에 그만뒀는지
  wrongAnswers: []    // 이번 판 오답 노트용
};

let currentScreen = "start";
let transitionTimer = null;
let transitionShownAt = 0;
let questionTimer = null;   // 문제 시간을 재는 setInterval
let lastRecordId = null;    // 순위표에서 강조할 방금 기록
let rankingMode = "all";    // 순위표에서 보고 있는 모드
let questionById = new Map();

// 지정한 화면 하나만 보이고 나머지는 숨긴다.
function showScreen(name) {
  if (!SCREENS.includes(name)) {
    console.error(`알 수 없는 화면: ${name}`);
    return;
  }
  if (name !== "quiz") stopQuestionTimer();
  SCREENS.forEach((screen) => {
    document.getElementById(`screen-${screen}`).hidden = screen !== name;
  });
  currentScreen = name;

  el.nav.hidden = !NAV_SCREENS.includes(name);
  el.navTabs.forEach((tab) => {
    if (tab.dataset.screen === name) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  el.wrongBadge.textContent = loadWrongIds().length;
}

// 문제 데이터를 검사하고 오류를 콘솔에 출력한다. 통과하면 true.
function validateQuestions() {
  const errors = [];

  if (typeof QUESTIONS === "undefined" || typeof CATEGORIES === "undefined") {
    errors.push("questions.js를 불러오지 못했습니다.");
  } else {
    CATEGORIES.forEach(({ key, name, chronological }) => {
      const list = QUESTIONS[key];
      if (!Array.isArray(list)) {
        errors.push(`${name}(${key}): 문제 배열이 없습니다.`);
        return;
      }
      if (list.length !== QUESTIONS_PER_CATEGORY) {
        errors.push(`${name}: 문제가 ${list.length}개입니다. (${QUESTIONS_PER_CATEGORY}개 필요)`);
      }
      list.forEach((q, i) => {
        const label = `${name} ${q.id || `${i + 1}번`}`;
        if (!Array.isArray(q.choices) || q.choices.length !== CHOICES_PER_QUESTION) {
          errors.push(`${label}: 보기가 ${CHOICES_PER_QUESTION}개가 아닙니다.`);
        }
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > CHOICES_PER_QUESTION - 1) {
          errors.push(`${label}: answer(${q.answer})가 0~${CHOICES_PER_QUESTION - 1} 범위를 벗어났습니다.`);
        }
        if (!Object.hasOwn(DIFFICULTIES, q.difficulty)) {
          errors.push(`${label}: difficulty(${q.difficulty})가 ${Object.keys(DIFFICULTIES).join("/")} 중 하나가 아닙니다.`);
        }
        if (chronological && typeof q.year !== "number") {
          errors.push(`${label}: 시대순 정렬에 필요한 year가 없습니다.`);
        }
      });
    });
  }

  errors.forEach((message) => console.error(`[문제 데이터 오류] ${message}`));
  return errors.length === 0;
}

// Fisher-Yates 셔플. 원본은 건드리지 않고 섞은 사본을 돌려준다.
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function categoryOf(key) {
  return CATEGORIES.find((c) => c.key === key);
}

function categoryName(key) {
  return categoryOf(key).name;
}

// 보기를 섞고, 정답 문자열 기준으로 새 정답 인덱스를 다시 계산한다.
function withShuffledChoices(q, key) {
  const correctText = q.choices[q.answer];
  const choices = shuffle(q.choices);
  return { ...q, choices, answer: choices.indexOf(correctText), category: key };
}

// 한 카테고리의 문제들을 출제 순서로 정리한다. 시대순 카테고리는 연도순, 나머지는 셔플.
function arrangeQuestions(key, list) {
  const ordered = categoryOf(key).chronological
    ? list.slice().sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
    : shuffle(list);
  return ordered.map((q) => withShuffledChoices(q, key));
}

// 카테고리에서 n개를 무작위로 뽑아 출제 순서로 정리한다.
function pickQuestions(key, n) {
  return arrangeQuestions(key, shuffle(QUESTIONS[key]).slice(0, n));
}

function formatTime(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// "2026-10-26T21:40:00+09:00" 형식 (로컬 시간 + 시간대)
function toLocalISOString(date) {
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

function textEl(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function difficultyLabel(key) {
  const { label, multiplier } = DIFFICULTIES[key];
  return `${label} ×${multiplier}`;
}

// ----- localStorage -----

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.error(`${key}를 읽지 못해 빈 목록으로 시작합니다.`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`${key}를 저장하지 못했습니다.`, error);
    return false;
  }
}

function isValidRecord(r) {
  return r && typeof r.id === "string" && Object.hasOwn(MODES, r.mode) && typeof r.score === "number" &&
    typeof r.correct === "number" && typeof r.elapsedSec === "number" && typeof r.playedAt === "string";
}

function loadRecords() {
  const parsed = readStorage(RECORDS_KEY, []);
  return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
}

function sortRecords(records) {
  return records.sort((a, b) => b.score - a.score || a.elapsedSec - b.elapsedSec || a.playedAt.localeCompare(b.playedAt));
}

// 틀린 문제 목록: 문제 id 배열. 다시 맞히면 빠진다.
function loadWrongIds() {
  const parsed = readStorage(WRONG_KEY, []);
  return Array.isArray(parsed) ? parsed.filter((id) => questionById.has(id)) : [];
}

function addWrongId(id) {
  const ids = loadWrongIds();
  if (!ids.includes(id)) writeStorage(WRONG_KEY, [...ids, id]);
}

function removeWrongId(id) {
  const ids = loadWrongIds();
  if (ids.includes(id)) writeStorage(WRONG_KEY, ids.filter((x) => x !== id));
}

// ----- 시작 화면 -----

// 문제 데이터 검증에 실패하면 시작 버튼을 막는다.
function updateStartButtons() {
  el.allStartButton.disabled = !dataValid;
  el.speedStartButton.disabled = !dataValid;
  [...el.subjectButtons.children].forEach((button) => {
    button.disabled = !dataValid;
  });
  el.startError.hidden = dataValid;
}

// 카테고리별 모드: 과목 버튼을 누르면 그 과목 10문제를 바로 시작한다.
function renderSubjectButtons() {
  el.subjectButtons.replaceChildren(...CATEGORIES.map(({ key, name }) => {
    const button = textEl("button", name, "btn subject-button");
    button.type = "button";
    button.addEventListener("click", () => startCategory(key));
    return button;
  }));
}

// ----- 게임 시작 -----

function startAll() {
  if (!dataValid) return;
  startGame("all", CATEGORIES.map(({ key, name }) => ({ key, name, queue: pickQuestions(key, QUESTIONS_PER_CATEGORY) })));
}

function startCategory(key) {
  if (!dataValid) return;
  startGame("category", [{ key, name: categoryName(key), queue: pickQuestions(key, QUESTIONS_PER_CATEGORY) }], key);
}

// 네 과목 문제를 모두 섞어 20문제를 뽑는다. 과목이 섞이므로 시대순 정렬은 하지 않는다.
function startSpeed() {
  if (!dataValid) return;
  const pool = CATEGORIES.flatMap(({ key }) => QUESTIONS[key].map((q) => ({ q, key })));
  const queue = shuffle(pool).slice(0, SPEED_QUESTIONS).map(({ q, key }) => withShuffledChoices(q, key));
  startGame("speed", [{ key: "speed", name: MODES.speed.name, queue }]);
}

// 틀린 문제를 카테고리 순서대로 모아 다시 푼다.
function startReview() {
  const ids = loadWrongIds();
  if (ids.length === 0) return;
  const queue = CATEGORIES.flatMap(({ key }) =>
    arrangeQuestions(key, QUESTIONS[key].filter((q) => ids.includes(q.id)))
  );
  startGame("review", [{ key: "review", name: "WRONG ANSWERS", queue }]);
}

// 세션 하나 = 과목 탭 하나의 진행 상태
function newSession(plan) {
  return {
    ...plan,           // key, name, queue
    index: 0,          // 지금 문제 번호
    correct: 0,        // 맞힌 수
    points: 0,         // 얻은 점수
    picked: null,      // 고른 보기 번호. 시간 초과면 TIMEOUT, 아직 안 골랐으면 null
    removed: null,     // 힌트로 지운 보기 번호 배열. 힌트를 안 썼으면 null
    spentMs: 0,        // 이 문제에 쓴 시간 (탭을 오가면 멈췄다가 이어서 잰다)
    shownAt: null,     // 시간을 재기 시작한 시각. 멈춰 있으면 null
    result: null       // 답한 뒤 보여 줄 득점 내역
  };
}

function startGame(mode, plan, category = null) {
  state.mode = mode;
  state.category = category;
  state.sessions = plan.map(newSession);
  state.current = 0;
  state.categoryScores = {};
  state.categoryTotals = {};
  plan.flatMap((p) => p.queue).forEach((q) => {
    state.categoryScores[q.category] = 0;
  });
  state.combo = 0;
  state.maxCombo = 0;
  state.breakdown = { base: 0, fast: 0, noHint: 0, combo: 0 };
  state.startedAt = Date.now();
  state.endedAt = null;
  state.quit = false;
  state.wrongAnswers = [];

  showScreen("quiz");
  renderQuestion();
}

// ----- 퀴즈 화면 -----

function currentSession() {
  return state.sessions[state.current];
}

function answeredCount(session) {
  return session.index + (session.picked === null ? 0 : 1);
}

function isDone(session) {
  return answeredCount(session) === session.queue.length;
}

function totalScore() {
  return state.sessions.reduce((sum, s) => sum + s.points, 0);
}

function totalCorrect() {
  return state.sessions.reduce((sum, s) => sum + s.correct, 0);
}

function totalQuestions() {
  return state.sessions.reduce((sum, s) => sum + s.queue.length, 0);
}

function answeredQuestions() {
  return state.sessions.flatMap((s) => s.queue.slice(0, answeredCount(s)));
}

// 고정 순서(한국사 → 과학 → 지리 → 일반상식)에서 아직 덜 푼 첫 과목
function nextUnfinished() {
  return state.sessions.findIndex((s) => !isDone(s));
}

// ----- 문제 시간 -----

function questionMs(s) {
  return s.spentMs + (s.shownAt === null ? 0 : Date.now() - s.shownAt);
}

// 지금 문제가 답하기 전이면 시간을 (이어서) 잰다.
function startQuestionTimer() {
  const s = currentSession();
  if (s.picked !== null || s.shownAt !== null) return;
  s.shownAt = Date.now();
  clearInterval(questionTimer);
  questionTimer = setInterval(tickQuestionTimer, TIMER_TICK_MS);
  renderTimer();
}

// 시간을 멈추고 지금까지 쓴 시간을 쌓아 둔다. (답했을 때, 탭을 옮길 때, 확인 창을 띄울 때)
function pauseQuestionTimer() {
  stopQuestionTimer();
  const s = currentSession();
  if (s && s.shownAt !== null) {
    s.spentMs += Date.now() - s.shownAt;
    s.shownAt = null;
  }
}

function stopQuestionTimer() {
  clearInterval(questionTimer);
  questionTimer = null;
}

function tickQuestionTimer() {
  if (questionMs(currentSession()) >= TIME_LIMIT_MS) {
    answer(TIMEOUT);
    return;
  }
  renderTimer();
}

// 시간 게이지: 왼쪽에서 오른쪽으로 차올라 제한 시간(15초)에 가득 찬다.
// 시간 보너스 기준(10초)을 넘기면 붉게 바뀐다.
function renderTimer() {
  const s = currentSession();
  const ms = s.result ? s.result.ms : questionMs(s);
  el.timeBar.style.width = `${Math.min(1, ms / TIME_LIMIT_MS) * 100}%`;
  el.timeGauge.setAttribute("aria-valuenow", Math.min(TIME_LIMIT_MS / 1000, Math.floor(ms / 1000)));
  el.timeGauge.classList.toggle("is-urgent", ms >= FAST_ANSWER_MS);
}

// 전체도전에서만 과목 탭을 보여준다. 탭을 누르면 그 과목의 진행 상태로 바로 넘어간다.
function renderTabs() {
  el.subjectTabs.hidden = state.sessions.length < 2;
  if (el.subjectTabs.hidden) return;

  el.subjectTabs.replaceChildren(...state.sessions.map((s, i) => {
    const done = isDone(s);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-tab";
    button.append(textEl("span", s.name, "subject-tab-name"),
      textEl("span", done ? `✓ ${s.correct}/${s.queue.length}` : `${answeredCount(s)}/${s.queue.length}`, "subject-tab-progress"));
    if (i === state.current) button.setAttribute("aria-current", "true");
    if (done) button.classList.add("is-done");
    button.disabled = Boolean(transitionTimer) || (done && i !== state.current);
    button.addEventListener("click", () => switchSession(i));
    return button;
  }));
}

function switchSession(index) {
  if (currentScreen !== "quiz" || transitionTimer || index === state.current) return;
  if (isDone(state.sessions[index])) return;
  pauseQuestionTimer();
  state.current = index;
  renderQuestion();
}

function updateProgress() {
  const s = currentSession();
  const done = answeredCount(s);
  el.progressBar.style.width = `${(done / s.queue.length) * 100}%`;
  el.progress.setAttribute("aria-valuemax", s.queue.length);
  el.progress.setAttribute("aria-valuenow", done);
  el.score.textContent = `SCORE ${totalScore()}`;
  el.combo.hidden = state.combo < 2;
  el.combo.textContent = `${state.combo} COMBO`;
}

// 현재 세션의 문제를 그린다. 이미 답한 문제(탭을 오가다 돌아온 경우)면 피드백까지 다시 보여준다.
function renderQuestion() {
  const s = currentSession();
  const q = s.queue[s.index];

  el.sign.textContent = `QUESTION ${String(s.index + 1).padStart(2, "0")}`;
  el.category.textContent = categoryName(q.category);
  el.difficulty.textContent = difficultyLabel(q.difficulty);
  el.difficulty.dataset.level = q.difficulty;
  el.counter.textContent = `${s.index + 1} / ${s.queue.length}`;
  el.question.textContent = q.question;

  el.choices.forEach((button, i) => {
    button.querySelector(".choice-text").textContent = q.choices[i];
    button.querySelector(".choice-mark").textContent = "";
    button.classList.remove("is-picked", "is-correct", "is-wrong", "is-removed");
    button.disabled = false;
  });
  renderRemoved();

  el.feedback.hidden = true;
  el.feedback.classList.remove("is-correct", "is-wrong");
  el.nextButton.hidden = true;

  if (s.picked === null) {
    el.question.focus();
    startQuestionTimer();
  } else {
    showFeedback();
  }
  renderTimer();
  updateProgress();
  renderTabs();
}

// 힌트로 지운 보기는 누를 수 없게 흐리게 표시한다.
function renderRemoved() {
  const s = currentSession();
  (s.removed || []).forEach((i) => {
    el.choices[i].classList.add("is-removed");
    el.choices[i].disabled = true;
  });
  el.hintButton.disabled = s.picked !== null || s.removed !== null;
  el.hintButton.textContent = s.removed === null ? "HINT!" : "HINT USED";
}

// 오답 보기 2개를 무작위로 지운다. 힌트를 쓴 문제는 힌트 미사용 보너스를 받지 못한다.
function useHint() {
  const s = currentSession();
  if (currentScreen !== "quiz" || transitionTimer || s.picked !== null || s.removed !== null) return;
  const q = s.queue[s.index];
  const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
  s.removed = shuffle(wrong).slice(0, HINT_REMOVE);
  renderRemoved();
  el.choices.find((button) => !button.disabled).focus();
}

function selectChoice(index) {
  const s = currentSession();
  if (s.removed !== null && s.removed.includes(index)) return;
  answer(index);
}

// 답을 확정한다. index가 TIMEOUT이면 시간 초과로 오답 처리한다.
function answer(index) {
  const s = currentSession();
  if (currentScreen !== "quiz" || transitionTimer || s.picked !== null) return;
  pauseQuestionTimer();
  s.picked = index;

  const q = s.queue[s.index];
  const correct = index === q.answer;
  s.result = scoreAnswer(q, correct, s.spentMs, s.removed !== null);
  if (correct) {
    s.correct += 1;
    s.points += s.result.total;
    state.categoryScores[q.category] += 1;
    removeWrongId(q.id);
  } else {
    addWrongId(q.id);
    state.wrongAnswers.push({
      category: q.category,
      question: q.question,
      chosen: index === TIMEOUT ? `시간 초과 (${TIME_LIMIT_MS / 1000}초)` : q.choices[index],
      answer: q.choices[q.answer],
      explanation: q.explanation
    });
  }
  if (state.sessions.every(isDone)) state.endedAt = Date.now();

  showFeedback();
  renderTimer();
  updateProgress();
  renderTabs();
  el.nextButton.focus();
}

// 한 문제의 득점 내역을 계산한다. 맞히면 콤보가 이어지고, 틀리거나 시간이 지나면 끊긴다.
function scoreAnswer(q, correct, ms, hintUsed) {
  if (!correct) {
    state.combo = 0;
    return { ms, total: 0, items: [] };
  }
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  const items = [{ kind: "base", label: difficultyLabel(q.difficulty), points: BASE_POINTS * DIFFICULTIES[q.difficulty].multiplier }];
  if (ms < FAST_ANSWER_MS) items.push({ kind: "fast", label: `${FAST_ANSWER_MS / 1000}초 안에`, points: FAST_BONUS });
  if (!hintUsed) items.push({ kind: "noHint", label: "힌트 없이", points: NO_HINT_BONUS });
  if (COMBO_BONUS[state.combo]) items.push({ kind: "combo", label: `${state.combo}연속`, points: COMBO_BONUS[state.combo] });

  items.forEach(({ kind, points }) => {
    state.breakdown[kind] += points;
  });
  return { ms, total: items.reduce((sum, item) => sum + item.points, 0), items };
}

function showFeedback() {
  const s = currentSession();
  const q = s.queue[s.index];
  const correct = s.picked === q.answer;
  const timedOut = s.picked === TIMEOUT;

  el.choices.forEach((button) => {
    button.disabled = true;
  });
  el.hintButton.disabled = true;
  if (!timedOut) el.choices[s.picked].classList.add("is-picked");
  markChoice(q.answer, true);
  if (!correct && !timedOut) markChoice(s.picked, false);

  if (correct) el.feedbackText.textContent = `✓ 정답입니다! +${s.result.total}점`;
  else if (timedOut) el.feedbackText.textContent = `⏱ 시간 초과! 정답은 '${q.choices[q.answer]}'`;
  else el.feedbackText.textContent = `✗ 오답입니다. 정답은 '${q.choices[q.answer]}'`;
  el.points.textContent = s.result.items.map(({ label, points }) => `${label} +${points}`).join(" · ");
  el.points.hidden = !correct;
  el.explanation.textContent = q.explanation;
  el.feedback.classList.add(correct ? "is-correct" : "is-wrong");
  el.feedback.hidden = false;

  const lastInSession = s.index === s.queue.length - 1;
  const othersLeft = state.sessions.some((other) => other !== s && !isDone(other));
  el.nextButton.textContent = !lastInSession ? "NEXT" : othersLeft ? "NEXT SUBJECT" : "SEE RESULTS";
  el.nextButton.hidden = false;
}

function markChoice(index, correct) {
  const button = el.choices[index];
  button.classList.add(correct ? "is-correct" : "is-wrong");
  button.querySelector(".choice-mark").textContent = correct ? "✓ 정답" : "✗ 내 답";
}

function nextQuestion() {
  const s = currentSession();
  if (currentScreen !== "quiz" || transitionTimer || s.picked === null) return;

  if (s.index < s.queue.length - 1) {
    Object.assign(s, { index: s.index + 1, picked: null, removed: null, spentMs: 0, shownAt: null, result: null });
    renderQuestion();
    return;
  }

  const next = nextUnfinished();
  if (next === -1) {
    finishGame();
  } else {
    showTransition(s, next);
  }
}

// 과목이 끝나면 그 과목 점수를 잠깐 보여주고 다음 과목으로 넘어간다. (F-11)
function showTransition(session, nextIndex) {
  el.quizBody.hidden = true;
  el.transitionText.textContent = `${session.name} ${session.correct} / ${session.queue.length}`;
  el.transition.hidden = false;
  transitionShownAt = Date.now();

  transitionTimer = setTimeout(() => {
    endTransition();
    state.current = nextIndex;
    renderQuestion();
  }, TRANSITION_MS);
  renderTabs();
}

function endTransition() {
  clearTimeout(transitionTimer);
  transitionTimer = null;
  // 안내가 떠 있던 시간은 소요 시간에서 뺀다.
  state.startedAt += Date.now() - transitionShownAt;
  el.transition.hidden = true;
  el.quizBody.hidden = false;
}

// 중간에 그만두기. 푼 문제가 있으면 확인을 받고 지금까지의 결과를 보여준다.
// 확인 창이 떠 있는 동안에는 문제 시간을 멈춘다.
function quitGame() {
  if (currentScreen !== "quiz") return;
  pauseQuestionTimer();
  if (answeredQuestions().length === 0) {
    goHome();
    return;
  }
  if (!confirm("벌써 무대를 떠나시려고요? 지금까지 푼 문제로 결과를 보여 드릴게요!")) {
    startQuestionTimer();
    return;
  }
  if (transitionTimer) endTransition();
  state.quit = true;
  if (state.endedAt === null) state.endedAt = Date.now();
  finishGame();
}

// ----- 결과 화면 -----

// 끝까지 푼 전체도전·카테고리별·스피드퀴즈 판만 그 모드의 순위표에 기록한다.
function isRankedGame() {
  return Object.hasOwn(MODES, state.mode) && !state.quit;
}

function finishGame() {
  pauseQuestionTimer();
  const elapsedSec = Math.round((state.endedAt - state.startedAt) / 1000);
  let rankText;

  state.categoryTotals = {};
  answeredQuestions().forEach((q) => {
    state.categoryTotals[q.category] = (state.categoryTotals[q.category] || 0) + 1;
  });

  if (state.quit) {
    rankText = `${totalQuestions()}문제 중 ${answeredQuestions().length}문제를 풀고 무대를 내려오셨네요! 중간에 그만둔 판은 순위표에 오르지 않아요!`;
  } else if (isRankedGame()) {
    const now = new Date();
    const record = {
      id: String(now.getTime()),
      mode: state.mode,
      category: state.category,
      score: totalScore(),
      correct: totalCorrect(),
      total: totalQuestions(),
      maxCombo: state.maxCombo,
      categoryScores: { ...state.categoryScores },
      elapsedSec,
      playedAt: toLocalISOString(now)
    };
    const records = loadRecords();
    records.push(record);
    writeStorage(RECORDS_KEY, records);
    const board = sortRecords(records.filter((r) => r.mode === state.mode));
    lastRecordId = record.id;
    rankingMode = state.mode;
    const rank = board.indexOf(record) + 1;
    rankText = `${MODES[state.mode].label} ${board.length}개 기록 중 ${rank}위! ${rank === 1 ? "오늘의 챔피언 탄생입니다!" : "큰 박수 부탁드립니다!"}`;
  } else {
    rankText = "복습 무대는 순위표에 기록되지 않아요! 그래도 실력은 확실히 늘었죠?!";
  }

  renderResult(elapsedSec, rankText);
  showScreen("result");
  el.resultTitle.focus();
}

function resultTitle() {
  if (state.mode === "category") return `${MODES.category.name} · ${categoryName(state.category)}`;
  if (state.mode === "review") return "WRONG ANSWERS";
  return MODES[state.mode].name;
}

function renderResult(elapsedSec, rankText) {
  const correct = totalCorrect();
  const total = answeredQuestions().length;
  el.resultTitle.textContent = resultTitle();
  el.resultScore.textContent = `${totalScore()}점`;
  el.resultPercent.textContent = `(${correct} / ${total} 정답 · ${Math.round((correct / total) * 100)}%)`;

  el.resultCategories.replaceChildren(...CATEGORIES.filter(({ key }) => state.categoryTotals[key]).map(({ key, name }) => {
    const li = document.createElement("li");
    li.append(textEl("span", name), textEl("span", `${state.categoryScores[key]} / ${state.categoryTotals[key]}`));
    return li;
  }));

  const { base, fast, noHint, combo } = state.breakdown;
  el.resultBreakdown.replaceChildren(...[
    ["기본 점수 (난이도 배수)", `${base}점`],
    ["시간 보너스", `${fast}점`],
    ["힌트 미사용 보너스", `${noHint}점`],
    ["콤보 보너스", `${combo}점`],
    ["최고 콤보", `${state.maxCombo}연속`]
  ].map(([label, value]) => {
    const li = document.createElement("li");
    li.append(textEl("span", label), textEl("span", value));
    return li;
  }));

  el.resultTime.textContent = formatTime(elapsedSec);
  el.resultRank.textContent = rankText;
  renderWrongNote();
}

// 이번 판에서 틀린 문제와 정답, 해설 목록 (F-12)
function renderWrongNote() {
  const wrong = state.wrongAnswers;
  el.wrongNoteSummary.textContent = `오답 노트 (${wrong.length}개)`;
  el.wrongNoteSummary.parentElement.open = false;

  if (wrong.length === 0) {
    el.wrongNoteList.replaceChildren(textEl("li", "틀린 문제가 하나도 없어요! 완벽한 무대였습니다!"));
    return;
  }
  el.wrongNoteList.replaceChildren(...wrong.map((w) => {
    const li = document.createElement("li");
    li.append(
      textEl("p", `[${categoryName(w.category)}] ${w.question}`, "wrong-note-question"),
      textEl("p", `✗ 내 답: ${w.chosen}`, "wrong-note-mine"),
      textEl("p", `✓ 정답: ${w.answer}`, "wrong-note-answer"),
      textEl("p", w.explanation, "wrong-note-explanation")
    );
    return li;
  }));
}

// ----- 틀린 문제 화면 -----

function showWrong() {
  renderWrong();
  showScreen("wrong");
  el.wrongTitle.focus();
}

function renderWrong() {
  const ids = loadWrongIds();
  // 카테고리 순서, 그 안에서는 문제 데이터 순서대로 보여준다.
  const items = CATEGORIES.flatMap(({ key, name }) =>
    QUESTIONS[key].filter((q) => ids.includes(q.id)).map((q) => ({ name, q }))
  );

  el.wrongEmpty.hidden = items.length > 0;
  el.wrongList.replaceChildren(...items.map(({ name, q }) => {
    const li = document.createElement("li");
    li.append(textEl("span", name, "badge"), textEl("span", q.question, "wrong-list-question"));
    return li;
  }));
  el.wrongRetryButton.textContent = items.length > 0 ? `RETRY WRONG ANSWERS (${items.length})` : "RETRY WRONG ANSWERS";
  el.wrongRetryButton.disabled = items.length === 0;
  el.wrongClearButton.disabled = items.length === 0;
}

function clearWrong() {
  if (!confirm("틀린 문제 목록을 깨끗하게 비워 드릴까요?!")) return;
  writeStorage(WRONG_KEY, []);
  renderWrong();
  showScreen("wrong");
}

// ----- 순위 화면 -----

function showRanking() {
  renderRanking();
  showScreen("ranking");
  el.rankingTitle.focus();
}

function selectRankingMode(mode) {
  rankingMode = mode;
  renderRanking();
}

function renderRankingTabs() {
  el.rankingTabs.replaceChildren(...Object.entries(MODES).map(([mode, { name, label }]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-tab";
    button.append(textEl("span", name, "subject-tab-name"), textEl("span", label, "subject-tab-progress"));
    button.setAttribute("aria-pressed", String(mode === rankingMode));
    button.addEventListener("click", () => selectRankingMode(mode));
    return button;
  }));
}

function renderRanking() {
  renderRankingTabs();
  el.rankingRule.textContent = MODES[rankingMode].rule;

  // 카테고리별 순위표에는 어느 과목 기록인지 함께 보여준다.
  const showSubject = rankingMode === "category";
  const headers = ["RANK", ...(showSubject ? ["SUBJECT"] : []), "SCORE", "CORRECT", "TIME", "DATE"];
  const headRow = document.createElement("tr");
  headRow.append(...headers.map((h) => {
    const th = textEl("th", h);
    th.scope = "col";
    return th;
  }));
  el.rankingHead.replaceChildren(headRow);

  const records = sortRecords(loadRecords().filter((r) => r.mode === rankingMode));
  const top = records.slice(0, RANKING_SIZE);

  if (top.length === 0) {
    const td = textEl("td", "아직 아무도 무대에 오르지 않았어요! 첫 번째 주인공이 되어 보세요!", "empty");
    td.colSpan = headers.length;
    const tr = document.createElement("tr");
    tr.append(td);
    el.rankingBody.replaceChildren(tr);
  } else {
    el.rankingBody.replaceChildren(...top.map((r, i) => {
      const tr = document.createElement("tr");
      const rank = textEl("td", `${i + 1}`);
      if (r.id === lastRecordId) {
        tr.className = "is-current";
        tr.setAttribute("aria-current", "true");
        rank.append(textEl("span", "NEW", "current-tag"));
      }
      tr.append(rank);
      if (showSubject) tr.append(textEl("td", categoryOf(r.category) ? categoryName(r.category) : "-"));
      tr.append(
        textEl("td", `${r.score}`),
        textEl("td", `${r.correct}/${r.total}`),
        textEl("td", formatTime(r.elapsedSec)),
        textEl("td", r.playedAt.slice(0, 10).replace(/-/g, "."))
      );
      return tr;
    }));
  }

  // 방금 기록이 10위 밖이면 순위를 따로 알려준다.
  const myRank = records.findIndex((r) => r.id === lastRecordId) + 1;
  el.rankingNote.hidden = myRank <= RANKING_SIZE;
  el.rankingNote.textContent = myRank > RANKING_SIZE ? `방금 기록은 전체 ${records.length}개 중 ${myRank}위예요! 다음엔 TOP 10을 노려 볼까요?!` : "";

  el.resetButton.disabled = records.length === 0;
}

// 확인 창을 거쳐 지금 보고 있는 모드의 기록을 모두 삭제 (F-13)
function resetRecords() {
  if (!confirm(`정말 ${MODES[rankingMode].label} 기록을 모두 지울까요? 한 번 지우면 되돌릴 수 없어요!`)) return;
  writeStorage(RECORDS_KEY, loadRecords().filter((r) => r.mode !== rankingMode));
  renderRanking();
}

function goHome() {
  showScreen("start");
  el.startTitle.focus();
}

function goTo(screen) {
  if (screen === "wrong") showWrong();
  else if (screen === "ranking") showRanking();
  else goHome();
}

// ----- 이벤트 -----

el.navTabs.forEach((tab) => tab.addEventListener("click", () => goTo(tab.dataset.screen)));
el.allStartButton.addEventListener("click", startAll);
el.speedStartButton.addEventListener("click", startSpeed);
el.hintButton.addEventListener("click", useHint);
el.choices.forEach((button) => {
  button.addEventListener("click", () => selectChoice(Number(button.dataset.index)));
});
el.nextButton.addEventListener("click", nextQuestion);
el.quitButton.addEventListener("click", quitGame);
el.retryButton.addEventListener("click", goHome);
el.resultWrongButton.addEventListener("click", showWrong);
el.resultRankingButton.addEventListener("click", showRanking);
el.wrongRetryButton.addEventListener("click", startReview);
el.wrongClearButton.addEventListener("click", clearWrong);
el.homeButton.addEventListener("click", goHome);
el.resetButton.addEventListener("click", resetRecords);

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (currentScreen !== "quiz") return;

  if (["1", "2", "3", "4"].includes(event.key)) {
    selectChoice(Number(event.key) - 1);
  } else if (event.key === "Enter" && currentSession().picked !== null) {
    // 포커스된 '다음' 버튼의 기본 클릭과 겹쳐 두 문제를 건너뛰지 않도록 막는다.
    event.preventDefault();
    nextQuestion();
  }
});

// ----- 초기화 -----

const dataValid = validateQuestions();
if (dataValid) {
  questionById = new Map(Object.values(QUESTIONS).flat().map((q) => [q.id, q]));
  renderSubjectButtons();
}
updateStartButtons();
showScreen("start");
