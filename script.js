// ============================================================
// Timed Typing Test — script.js
// ============================================================

// ── DOM References ──────────────────────────────────────────
const testWrapper  = document.querySelector(".test-wrapper");
const testArea     = document.querySelector("#test-area");
const originTextEl = document.querySelector("#origin-text p");
const resetButton  = document.querySelector("#reset");
const theTimer     = document.querySelector(".timer");
const wpmDisplay   = document.querySelector("#wpm");
const errorDisplay = document.querySelector("#error-count");
const scoresList   = document.querySelector("#scores-list");

// ── Text Paragraphs (Content Randomization) ─────────────────
const paragraphs = [
  "The quick brown fox jumps over the lazy dog near the riverbank at dusk, while the birds sing softly in the distance.",
  "A network packet travels through routers and switches, each hop bringing it closer to its destination across the internet.",
  "Digital forensics requires a methodical approach: preserve the evidence, document every step, and let the data tell the story.",
  "Red teams simulate adversaries to expose weaknesses, while blue teams defend and respond — together they form the purple team.",
  "Every great codebase starts with a single function, written carefully, tested thoroughly, and refactored with purpose over time.",
  "The camera shutter opens for a fraction of a second, freezing motion and light into a memory that outlasts the moment.",
  "Penetration testers think like attackers so that defenders can build walls strong enough to withstand the real thing.",
];

// ── State Variables ──────────────────────────────────────────
let timerInterval  = null;   // holds the setInterval reference
let startTime      = null;   // timestamp when typing began
let isRunning      = false;  // is the timer currently ticking
let errorCount     = 0;      // mistakes made this session
let currentText    = "";     // the active paragraph to type

// ── Helpers ──────────────────────────────────────────────────

/**
 * Pads a number to at least 2 digits (e.g. 7 → "07").
 * @param {number} n
 * @returns {string}
 */
function addLeadingZero(n) {
  return n < 10 ? "0" + n : String(n);
}

/**
 * Picks a random paragraph, avoiding repeating the same one twice.
 * @returns {string}
 */
function getRandomParagraph() {
  let newText;
  do {
    newText = paragraphs[Math.floor(Math.random() * paragraphs.length)];
  } while (newText === currentText && paragraphs.length > 1);
  return newText;
}

// ── Timer Functions ──────────────────────────────────────────

/**
 * Updates the on-screen timer display (MM:SS:HH).
 */
function updateTimerDisplay() {
  const totalHundredths = Math.floor((Date.now() - startTime) / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  theTimer.textContent =
    addLeadingZero(minutes) + ":" +
    addLeadingZero(seconds) + ":" +
    addLeadingZero(hundredths);
}

/**
 * Starts the interval-based timer.
 */
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startTime = Date.now();
  timerInterval = setInterval(updateTimerDisplay, 10);
}

/**
 * Stops the timer and returns elapsed seconds as a float.
 * @returns {number}
 */
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  return (Date.now() - startTime) / 1000;
}

// ── WPM Calculation ──────────────────────────────────────────

/**
 * Standard WPM formula: (chars / 5) / (seconds / 60)
 * @param {number} charCount
 * @param {number} seconds
 * @returns {number}
 */
function calcWPM(charCount, seconds) {
  if (seconds === 0) return 0;
  return Math.round((charCount / 5) / (seconds / 60));
}

// ── Text Matching & Visual Feedback ─────────────────────────

/**
 * Runs on every input event. Handles:
 *  - Timer start on first keystroke
 *  - Error counting
 *  - Border color feedback (grey / blue / red / green)
 *  - Live WPM display
 *  - Completion detection
 */
function matchText() {
  const typed  = testArea.value;
  const origin = currentText;

  // Start the timer on the very first keystroke
  if (!isRunning && typed.length > 0) {
    startTimer();
  }

  // Count mismatched characters up to the length typed
  let errors = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== origin[i]) {
      errors++;
    }
  }

  // Increment session error counter whenever new mistakes appear
  if (errors > errorCount) {
    errorCount = errors;
    errorDisplay.textContent = errorCount;
  }

  // ── Border color feedback ──
  if (typed.length === 0) {
    testWrapper.style.borderColor = "grey";
  } else if (errors > 0 || typed.length > origin.length) {
    testWrapper.style.borderColor = "#e74c3c"; // red/orange — typo detected
  } else {
    testWrapper.style.borderColor = "#3498db"; // blue — matching correctly
  }

  // Live WPM update while typing
  if (isRunning) {
    const elapsed = (Date.now() - startTime) / 1000;
    wpmDisplay.textContent = calcWPM(typed.length, elapsed);
  }

  // ── Completion: typed string matches origin exactly ──
  if (typed === origin) {
    const totalSeconds = stopTimer();
    const finalWPM = calcWPM(origin.length, totalSeconds);

    testWrapper.style.borderColor = "#2ecc71"; // green — test complete!
    wpmDisplay.textContent = finalWPM;
    testArea.disabled = true; // lock textarea after completion

    saveScore(totalSeconds, finalWPM);
    renderScores();
  }
}

// ── Local Storage — Top 3 Scores ────────────────────────────

/**
 * Loads scores array from localStorage.
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
 * Adds a new score and persists only the top 3 fastest times.
 * @param {number} time - elapsed seconds
 * @param {number} wpm  - words per minute
 */
function saveScore(time, wpm) {
  const scores = loadScores();
  scores.push({ time, wpm });
  scores.sort((a, b) => a.time - b.time); // sort ascending by time (fastest first)
  localStorage.setItem("typingScores", JSON.stringify(scores.slice(0, 3)));
}

/**
 * Renders the current top 3 scores into the scoreboard list.
 */
function renderScores() {
  const scores = loadScores();
  scoresList.innerHTML = "";

  if (scores.length === 0) {
    scoresList.innerHTML = "<li>No scores yet — finish a test!</li>";
    return;
  }

  scores.forEach((score, index) => {
    // Convert decimal seconds back to MM:SS:HH for display
    const totalHundredths = Math.round(score.time * 100);
    const hundredths = totalHundredths % 100;
    const totalSecs  = Math.floor(totalHundredths / 100);
    const secs       = totalSecs % 60;
    const mins       = Math.floor(totalSecs / 60);
    const timeStr    = addLeadingZero(mins) + ":" + addLeadingZero(secs) + ":" + addLeadingZero(hundredths);

    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">#${index + 1}</span> ${timeStr} &mdash; <strong>${score.wpm} WPM</strong>`;
    scoresList.appendChild(li);
  });
}

// ── Reset Logic ──────────────────────────────────────────────

/**
 * Clears all state, resets the UI, and loads a new random paragraph.
 */
function resetTest() {
  if (isRunning) stopTimer();

  // Reset all state variables
  isRunning     = false;
  errorCount    = 0;
  timerInterval = null;

  // Reset all UI elements
  theTimer.textContent          = "00:00:00";
  testArea.value                = "";
  testArea.disabled             = false;
  testWrapper.style.borderColor = "grey";
  wpmDisplay.textContent        = "0";
  errorDisplay.textContent      = "0";

  // Load a new random paragraph into the origin-text element
  currentText = getRandomParagraph();
  originTextEl.textContent = currentText;

  testArea.focus();
}

// ── Event Listeners ──────────────────────────────────────────

testArea.addEventListener("input", matchText);   // check text on every keystroke
resetButton.addEventListener("click", resetTest); // reset button handler

// ── Initialization ───────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  currentText = getRandomParagraph();
  originTextEl.textContent = currentText;
  renderScores();
});
