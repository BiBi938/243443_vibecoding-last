const SCREENS = ["start", "quiz", "result", "wrong", "ranking"];
const NAV_SCREENS = ["start", "wrong", "ranking"];
const QUESTIONS_PER_CATEGORY = 10;
const CHOICES_PER_QUESTION = 4;
const RECORDS_KEY = "quiz-records";
const WRONG_KEY = "quiz-wrong";
const RANKING_SIZE = 10;
const TRANSITION_MS = 1500;

const el = {
  navTabs: [...document.querySelectorAll("#app-nav .nav-tab")],
  nav: document.getElementById("app-nav"),
  wrongBadge: document.getElementById("wrong-badge"),
  startTitle: document.getElementById("start-title"),
  startError: document.getElementById("start-error"),
  subjectButtons: document.getElementById("subject-buttons"),
  countPanel: document.getElementById("count-panel"),
  countLabel: document.getElementById("count-label"),
  countDisplay: document.getElementById("count-display"),
  countInput: document.getElementById("count-input"),
  countSlider: document.getElementById("count-slider"),
  countMax: document.getElementById("count-max"),
  subjectStartButton: document.getElementById("subject-start-button"),
  allStartButton: document.getElementById("all-start-button"),
  allSummary: document.getElementById("all-summary"),
  subjectTabs: document.getElementById("subject-tabs"),
  sign: document.getElementById("quiz-sign"),
  category: document.getElementById("quiz-category"),
  counter: document.getElementById("quiz-counter"),
  score: document.getElementById("quiz-score"),
  progress: document.querySelector("#screen-quiz .progress"),
  progressBar: document.getElementById("quiz-progress-bar"),
  transition: document.getElementById("quiz-transition"),
  transitionText: document.getElementById("quiz-transition-text"),
  quizBody: document.getElementById("quiz-body"),
  question: document.getElementById("quiz-question"),
  choices: [...document.querySelectorAll("#quiz-choices .choice")],
  feedback: document.getElementById("quiz-feedback"),
  feedbackText: document.getElementById("quiz-feedback-text"),
  explanation: document.getElementById("quiz-explanation"),
  nextButton: document.getElementById("next-button"),
  quitButton: document.getElementById("quit-button"),
  resultTitle: document.getElementById("result-title"),
  resultScore: document.getElementById("result-score"),
  resultPercent: document.getElementById("result-percent"),
  resultCategories: document.getElementById("result-categories"),
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
  rankingBody: document.getElementById("ranking-body"),
  rankingNote: document.getElementById("ranking-note"),
  homeButton: document.getElementById("home-button"),
  resetButton: document.getElementById("reset-button")
};

// 게임 진행 상태 (메모리, 저장 안 함)
const state = {
  mode: null,        // "single"(한 과목) | "all"(모든 과목) | "review"(틀린 문제)
  sessions: [],       // 과목 탭마다 따로 진행: { key, name, queue, index, score, picked }
  current: 0,         // 지금 보고 있는 세션
  categoryScores: {}, // 카테고리별 맞힌 수
  categoryTotals: {}, // 카테고리별 푼 문제 수 (결과 계산 때 채움)
  startedAt: null,    // Date.now()
  endedAt: null,      // 마지막 문제에 답한 시각 (그만두면 그만둔 시각)
  quit: false,        // 중간에 그만뒀는지
  wrongAnswers: []    // 이번 판 오답 노트용
};

let currentScreen = "start";
let transitionTimer = null;
let transitionShownAt = 0;
let lastRecordId = null;    // 순위표에서 강조할 방금 기록
let selectedSubject = null; // 시작 화면에서 문제 수를 고르고 있는 과목
let counts = {};            // 과목별로 풀 문제 수
let questionById = new Map();

// 지정한 화면 하나만 보이고 나머지는 숨긴다.
function showScreen(name) {
  if (!SCREENS.includes(name)) {
    console.error(`알 수 없는 화면: ${name}`);
    return;
  }
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

// 한 카테고리의 문제들을 출제 순서로 정리한다. 시대순 카테고리는 연도순, 나머지는 셔플.
// 보기는 항상 섞고, 정답 문자열 기준으로 새 정답 인덱스를 다시 계산한다.
function arrangeQuestions(key, list) {
  const ordered = categoryOf(key).chronological
    ? list.slice().sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
    : shuffle(list);
  return ordered.map((q) => {
    const correctText = q.choices[q.answer];
    const choices = shuffle(q.choices);
    return { ...q, choices, answer: choices.indexOf(correctText), category: key };
  });
}

// 카테고리에서 n개를 무작위로 뽑아 출제 순서로 정리한다.
function pickQuestions(key, n) {
  return arrangeQuestions(key, shuffle(QUESTIONS[key]).slice(0, n));
}

// "1 QUESTION" / "10 QUESTIONS"
function questionsLabel(n) {
  return `${n} QUESTION${n === 1 ? "" : "S"}`;
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
  return r && typeof r.id === "string" && typeof r.score === "number" && typeof r.elapsedSec === "number" && typeof r.playedAt === "string";
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
  el.subjectStartButton.disabled = !dataValid;
  el.allStartButton.disabled = !dataValid;
  el.startError.hidden = dataValid;
}

function renderSubjectButtons() {
  el.subjectButtons.replaceChildren(...CATEGORIES.map(({ key, name }) => {
    const button = textEl("button", name, "btn subject-button");
    button.type = "button";
    button.dataset.key = key;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-controls", "count-panel");
    button.addEventListener("click", () => selectSubject(key));
    return button;
  }));
}

// 과목 버튼을 누르면 문제 수 패널을 연다. 같은 버튼을 다시 누르면 닫는다.
function selectSubject(key) {
  selectedSubject = selectedSubject === key ? null : key;
  [...el.subjectButtons.children].forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.key === selectedSubject));
  });
  closeCountInput(false);
  el.countPanel.hidden = selectedSubject === null;
  if (selectedSubject === null) return;

  const max = QUESTIONS[key].length;
  el.countSlider.max = max;
  el.countInput.max = max;
  el.countMax.textContent = max;
  el.countLabel.textContent = categoryName(key);
  renderCount();
}

function setCount(key, value) {
  const max = QUESTIONS[key].length;
  counts[key] = Math.min(max, Math.max(1, Math.round(value)));
  renderCount();
}

function renderCount() {
  if (selectedSubject !== null) {
    const n = counts[selectedSubject];
    el.countSlider.value = n;
    el.countDisplay.textContent = n;
    el.subjectStartButton.textContent = `PLAY ${categoryName(selectedSubject)} · ${questionsLabel(n)}`;
  }
  const total = CATEGORIES.reduce((sum, { key }) => sum + counts[key], 0);
  el.allSummary.textContent = `${CATEGORIES.map(({ key, name }) => `${name} ${counts[key]}`).join(" · ")} (${questionsLabel(total)})`;
}

// 숫자를 누르면 직접 입력칸으로 바뀐다.
function openCountInput() {
  el.countInput.value = counts[selectedSubject];
  el.countDisplay.hidden = true;
  el.countInput.hidden = false;
  el.countInput.focus();
  el.countInput.select();
}

function closeCountInput(commit) {
  if (el.countInput.hidden) return;
  if (commit && selectedSubject !== null) {
    const value = Number(el.countInput.value);
    if (el.countInput.value.trim() !== "" && Number.isFinite(value)) setCount(selectedSubject, value);
  }
  el.countInput.hidden = true;
  el.countDisplay.hidden = false;
  renderCount();
}

// ----- 게임 시작 -----

function startSubject() {
  if (!dataValid || selectedSubject === null) return;
  const key = selectedSubject;
  startGame("single", [{ key, name: categoryName(key), queue: pickQuestions(key, counts[key]) }]);
}

function startAll() {
  if (!dataValid) return;
  startGame("all", CATEGORIES.map(({ key, name }) => ({ key, name, queue: pickQuestions(key, counts[key]) })));
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

function startGame(mode, plan) {
  closeCountInput(true);
  state.mode = mode;
  state.sessions = plan.map((p) => ({ ...p, index: 0, score: 0, picked: null }));
  state.current = 0;
  state.categoryScores = {};
  state.categoryTotals = {};
  plan.flatMap((p) => p.queue).forEach((q) => {
    state.categoryScores[q.category] = 0;
  });
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
  return state.sessions.reduce((sum, s) => sum + s.score, 0);
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

// 모든 과목 풀기에서만 과목 탭을 보여준다. 탭을 누르면 그 과목의 진행 상태로 바로 넘어간다.
function renderTabs() {
  el.subjectTabs.hidden = state.sessions.length < 2;
  if (el.subjectTabs.hidden) return;

  el.subjectTabs.replaceChildren(...state.sessions.map((s, i) => {
    const done = isDone(s);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-tab";
    button.append(textEl("span", s.name, "subject-tab-name"),
      textEl("span", done ? `✓ ${s.score}/${s.queue.length}` : `${answeredCount(s)}/${s.queue.length}`, "subject-tab-progress"));
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
}

// 현재 세션의 문제를 그린다. 이미 답한 문제(탭을 오가다 돌아온 경우)면 피드백까지 다시 보여준다.
function renderQuestion() {
  const s = currentSession();
  const q = s.queue[s.index];

  el.sign.textContent = `QUESTION ${String(s.index + 1).padStart(2, "0")}`;
  el.category.textContent = categoryName(q.category);
  el.counter.textContent = `${s.index + 1} / ${s.queue.length}`;
  el.question.textContent = q.question;

  el.choices.forEach((button, i) => {
    button.querySelector(".choice-text").textContent = q.choices[i];
    button.querySelector(".choice-mark").textContent = "";
    button.classList.remove("is-picked", "is-correct", "is-wrong");
    button.disabled = false;
  });

  el.feedback.hidden = true;
  el.feedback.classList.remove("is-correct", "is-wrong");
  el.nextButton.hidden = true;

  if (s.picked === null) el.question.focus();
  else showFeedback();
  updateProgress();
  renderTabs();
}

function selectChoice(index) {
  const s = currentSession();
  if (currentScreen !== "quiz" || transitionTimer || s.picked !== null) return;
  s.picked = index;

  const q = s.queue[s.index];
  if (index === q.answer) {
    s.score += 1;
    state.categoryScores[q.category] += 1;
    removeWrongId(q.id);
  } else {
    addWrongId(q.id);
    state.wrongAnswers.push({
      category: q.category,
      question: q.question,
      chosen: q.choices[index],
      answer: q.choices[q.answer],
      explanation: q.explanation
    });
  }
  if (state.sessions.every(isDone)) state.endedAt = Date.now();

  showFeedback();
  updateProgress();
  renderTabs();
  el.nextButton.focus();
}

function showFeedback() {
  const s = currentSession();
  const q = s.queue[s.index];
  const correct = s.picked === q.answer;

  el.choices.forEach((button) => {
    button.disabled = true;
  });
  el.choices[s.picked].classList.add("is-picked");
  markChoice(q.answer, true);
  if (!correct) markChoice(s.picked, false);

  el.feedbackText.textContent = correct ? "✓ 정답입니다!" : `✗ 오답입니다. 정답은 '${q.choices[q.answer]}'`;
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
    s.index += 1;
    s.picked = null;
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
  el.transitionText.textContent = `${session.name} ${session.score} / ${session.queue.length}`;
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
function quitGame() {
  if (currentScreen !== "quiz") return;
  if (answeredQuestions().length === 0) {
    goHome();
    return;
  }
  if (!confirm("벌써 무대를 떠나시려고요? 지금까지 푼 문제로 결과를 보여 드릴게요!")) return;
  if (transitionTimer) endTransition();
  state.quit = true;
  if (state.endedAt === null) state.endedAt = Date.now();
  finishGame();
}

// ----- 결과 화면 -----

// 모든 과목을 10문제씩 푼 판만 순위표에 기록한다. (문제 수가 다르면 점수를 비교할 수 없음)
function isRankedGame() {
  return state.mode === "all" && !state.quit && state.sessions.every((s) => s.queue.length === QUESTIONS_PER_CATEGORY);
}

function finishGame() {
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
      score: totalScore(),
      categoryScores: { ...state.categoryScores },
      elapsedSec,
      playedAt: toLocalISOString(now)
    };
    const records = loadRecords();
    records.push(record);
    writeStorage(RECORDS_KEY, records);
    sortRecords(records);
    lastRecordId = record.id;
    const rank = records.indexOf(record) + 1;
    rankText = `전체 ${records.length}개 기록 중 ${rank}위! ${rank === 1 ? "오늘의 챔피언 탄생입니다!" : "큰 박수 부탁드립니다!"}`;
  } else if (state.mode === "review") {
    rankText = "복습 무대는 순위표에 기록되지 않아요! 그래도 실력은 확실히 늘었죠?!";
  } else {
    rankText = `모든 과목을 ${QUESTIONS_PER_CATEGORY}문제씩 풀어야 순위표에 오를 수 있어요! 다음엔 풀코스에 도전해 볼까요?!`;
  }

  renderResult(elapsedSec, rankText);
  showScreen("result");
  el.resultTitle.focus();
}

function renderResult(elapsedSec, rankText) {
  const score = totalScore();
  const total = answeredQuestions().length;
  el.resultScore.textContent = `${score} / ${total}`;
  el.resultPercent.textContent = `(${Math.round((score / total) * 100)}점)`;

  el.resultCategories.replaceChildren(...CATEGORIES.filter(({ key }) => state.categoryTotals[key]).map(({ key, name }) => {
    const li = document.createElement("li");
    li.append(textEl("span", name), textEl("span", `${state.categoryScores[key]} / ${state.categoryTotals[key]}`));
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

function renderRanking() {
  const records = sortRecords(loadRecords());
  const top = records.slice(0, RANKING_SIZE);

  if (top.length === 0) {
    const td = textEl("td", "아직 아무도 무대에 오르지 않았어요! 첫 번째 주인공이 되어 보세요!", "empty");
    td.colSpan = 4;
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
      tr.append(
        rank,
        textEl("td", `${r.score}`),
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

// 확인 창을 거쳐 전체 기록 삭제 (F-13)
function resetRecords() {
  if (!confirm("정말 모든 기록을 지울까요? 한 번 지우면 되돌릴 수 없어요!")) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch (error) {
    console.error("기록을 삭제하지 못했습니다.", error);
  }
  lastRecordId = null;
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
el.countSlider.addEventListener("input", () => setCount(selectedSubject, Number(el.countSlider.value)));
el.countDisplay.addEventListener("click", openCountInput);
el.countInput.addEventListener("blur", () => closeCountInput(true));
el.countInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    closeCountInput(true);
    el.countDisplay.focus();
  } else if (event.key === "Escape") {
    closeCountInput(false);
    el.countDisplay.focus();
  }
});
el.subjectStartButton.addEventListener("click", startSubject);
el.allStartButton.addEventListener("click", startAll);
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
  counts = Object.fromEntries(CATEGORIES.map(({ key }) => [key, Math.min(QUESTIONS_PER_CATEGORY, QUESTIONS[key].length)]));
  renderSubjectButtons();
  renderCount();
}
updateStartButtons();
showScreen("start");
