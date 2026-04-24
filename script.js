// ============================================================
// TYPIST — script.js
// ============================================================

// ── DOM References ───────────────────────────────────────────
const testArea     = document.querySelector("#test-area");
const originTextEl = document.querySelector("#origin-text-p");
const resetButton  = document.querySelector("#reset");
const theTimer     = document.querySelector("#timer");
const wpmDisplay   = document.querySelector("#wpm");
const errorDisplay = document.querySelector("#error-count");
const scoresList   = document.querySelector("#scores-list");
const cardInput    = document.querySelector(".card--input");

// ── Text Paragraphs (Content Randomization) ──────────────────
const paragraphs = [
  "The quick brown fox jumps over the lazy dog near the riverbank at dusk, while the birds sing softly in the distance.",
  "A network packet travels through routers and switches, each hop bringing it closer to its destination across the internet.",
  "Digital forensics requires a methodical approach: preserve the evidence, document every step, and let the data tell the story.",
  "Red teams simulate adversaries to expose weaknesses, while blue teams defend and respond, together they form the purple team.",
  "Every great codebase starts with a single function, written carefully, tested thoroughly, and refactored with purpose over time.",
  "The camera shutter opens for a fraction of a second, freezing motion and light into a memory that outlasts the moment.",
  "Penetration testers think like attackers so that defenders can build walls strong enough to withstand the real thing.",
];

// ── State ────────────────────────────────────────────────────
let timerInterval = null;
let startTime     = null;
let isRunning     = false;
let errorCount    = 0;
let currentText   = "";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Pads a number to at least 2 digits (e.g. 7 becomes "07").
 * @param {number} n
 * @returns {string}
 */
function addLeadingZero(n) {
  return n < 10 ? "0" + n : String(n);
}

/**
 * Picks a random paragraph, avoiding consecutive repeats.
 * @returns {string}
 */
function getRandomParagraph() {
  let pick;
  do {
    pick = paragraphs[Math.floor(Math.random() * paragraphs.length)];
  } while (pick === currentText && paragraphs.length > 1);
  return pick;
}

/**
 * Applies a state class to the textarea and card strip, removing others.
 * @param {string} state - "correct" | "error" | "done" | ""
 */
function setInputState(state) {
  testArea.classList.remove("state-correct", "state-error", "state-done");
  cardInput.classList.remove("state-correct", "state-error", "state-done");
  if (state) {
    testArea.classList.add("state-" + state);
    cardInput.classList.add("state-" + state);
  }
}

// ── Timer ────────────────────────────────────────────────────

/**
 * Repaints the timer display from elapsed milliseconds.
 */
function updateTimerDisplay() {
  const totalHundredths = Math.floor((Date.now() - startTime) / 10);
  const hundredths  = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  theTimer.textContent =
    addLeadingZero(minutes) + ":" +
    addLeadingZero(seconds) + ":" +
    addLeadingZero(hundredths);
}

/**
 * Starts the interval-based timer on first keystroke.
 */
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startTime = Date.now();
  timerInterval = setInterval(updateTimerDisplay, 10);
}

/**
 * Stops the timer and returns total elapsed seconds.
 * @returns {number}
 */
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  return (Date.now() - startTime) / 1000;
}

// ── WPM ──────────────────────────────────────────────────────

/**
 * Standard WPM formula: (characters / 5) / (seconds / 60).
 * @param {number} chars
 * @param {number} seconds
 * @returns {number}
 */
function calcWPM(chars, seconds) {
  if (seconds === 0) return 0;
  return Math.round((chars / 5) / (seconds / 60));
}

// ── Text Matching ────────────────────────────────────────────

/**
 * Fires on every input event. Starts the timer, tracks errors,
 * updates visual state, live WPM, and detects test completion.
 */
function matchText() {
  const typed  = testArea.value;
  const origin = currentText;

  // Kick off timer on first character
  if (!isRunning && typed.length > 0) startTimer();

  // Count characters typed that differ from origin
  let errors = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== origin[i]) errors++;
  }

  // Accumulate session error total
  if (errors > errorCount) {
    errorCount = errors;
    errorDisplay.textContent = errorCount;
    errorDisplay.classList.add("has-errors");
  }

  // Border and textarea visual state
  if (typed.length === 0) {
    setInputState("");
  } else if (errors > 0 || typed.length > origin.length) {
    setInputState("error");
  } else {
    setInputState("correct");
  }

  // Live WPM update
  if (isRunning) {
    const elapsed = (Date.now() - startTime) / 1000;
    wpmDisplay.textContent = calcWPM(typed.length, elapsed);
  }

  // Completion: exact match
  if (typed === origin) {
    const totalSeconds = stopTimer();
    const finalWPM = calcWPM(origin.length, totalSeconds);

    setInputState("done");
    wpmDisplay.textContent = finalWPM;
    testArea.disabled = true;

    saveScore(totalSeconds, finalWPM);
    renderScores();
  }
}

// ── Local Storage ────────────────────────────────────────────

/**
 * Retrieves the scores array from localStorage.
 * @returns {Array<{time: number, wpm: number}>}
 */
function loadScores() {
  try {
    return JSON.parse(localStorage.getItem("typingScores")) || [];
  } catch {
    return [];
  }
}

/**
 * Persists a new score, keeping only the top 3 fastest times.
 * @param {number} time
 * @param {number} wpm
 */
function saveScore(time, wpm) {
  const scores = loadScores();
  scores.push({ time, wpm });
  scores.sort((a, b) => a.time - b.time);
  localStorage.setItem("typingScores", JSON.stringify(scores.slice(0, 3)));
}

/**
 * Renders the top 3 scores into the scoreboard list element.
 */
function renderScores() {
  const scores = loadScores();
  scoresList.innerHTML = "";

  if (scores.length === 0) {
    scoresList.innerHTML = '<li class="scores-empty">No records yet. Finish a test to set one.</li>';
    return;
  }

  const rankLabels = ["01", "02", "03"];
  const rankClasses = ["score-rank--first", "score-rank--second", "score-rank--third"];

  scores.forEach((score, index) => {
    const totalHundredths = Math.round(score.time * 100);
    const hundredths  = totalHundredths % 100;
    const totalSecs   = Math.floor(totalHundredths / 100);
    const secs        = totalSecs % 60;
    const mins        = Math.floor(totalSecs / 60);
    const timeStr     = addLeadingZero(mins) + ":" + addLeadingZero(secs) + ":" + addLeadingZero(hundredths);

    const li = document.createElement("li");
    li.innerHTML =
      `<span class="score-rank ${rankClasses[index]}">${rankLabels[index]}</span>` +
      `<span class="score-time">${timeStr}</span>` +
      `<span class="score-wpm">${score.wpm} wpm</span>`;
    scoresList.appendChild(li);
  });
}

// ── Reset ────────────────────────────────────────────────────

/**
 * Clears all state and UI, loads a fresh random paragraph.
 */
function resetTest() {
  if (isRunning) stopTimer();

  isRunning     = false;
  errorCount    = 0;
  timerInterval = null;

  theTimer.textContent     = "00:00:00";
  testArea.value           = "";
  testArea.disabled        = false;
  wpmDisplay.textContent   = "0";
  errorDisplay.textContent = "0";
  errorDisplay.classList.remove("has-errors");

  setInputState("");

  currentText = getRandomParagraph();
  originTextEl.textContent = currentText;

  testArea.focus();
}

// ── Event Listeners ──────────────────────────────────────────

testArea.addEventListener("input", matchText);
resetButton.addEventListener("click", resetTest);

// ── Init ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  currentText = getRandomParagraph();
  originTextEl.textContent = currentText;
  renderScores();
});
