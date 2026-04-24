// ============================================================
// TYPIST — script.js
// ============================================================

// ── DOM References ───────────────────────────────────────────
const testArea       = document.querySelector("#test-area");
const originTextEl   = document.querySelector("#origin-text-p");
const resetButton    = document.querySelector("#reset");
const timerEl        = document.querySelector("#timer");
const wpmDisplay     = document.querySelector("#wpm");
const errorDisplay   = document.querySelector("#error-count");
const scoresList     = document.querySelector("#scores-list");
const cardInput      = document.querySelector(".card--input");
const bgCanvas       = document.querySelector("#bg-canvas");
const completionFlash = document.querySelector("#completion-flash");

// ── Text Paragraphs ──────────────────────────────────────────
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
let lastErrorCount = 0;

// ── Web Audio Context (lazy init on first interaction) ───────
let audioCtx = null;

/**
 * Initialises the AudioContext on first use.
 * Browsers block autoplay until a user gesture has occurred.
 */
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/**
 * Plays a short synthetic click — a brief band-pass burst of noise
 * that mimics a mechanical key without being loud or annoying.
 */
function playKeyClick() {
  try {
    const ctx  = getAudioCtx();
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6);
    }

    const src    = ctx.createBufferSource();
    src.buffer   = buf;

    const filter      = ctx.createBiquadFilter();
    filter.type       = "bandpass";
    filter.frequency.value = 3800;
    filter.Q.value    = 0.6;

    const gain        = ctx.createGain();
    gain.gain.value   = 0.28;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (_) {}
}

/**
 * Plays a low, short thud — indicates a typo.
 */
function playErrorSound() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type             = "sine";
    osc.frequency.value  = 160;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (_) {}
}

/**
 * Plays a rising two-tone chime — completion reward.
 */
function playCompleteSound() {
  try {
    const ctx   = getAudioCtx();
    const notes = [523.25, 783.99, 1046.5]; // C5, G5, C6

    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime + i * 0.12;

      osc.type            = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch (_) {}
}

// ── Canvas Background ─────────────────────────────────────────
// Animated particle grid: nodes drift slowly, nearby pairs
// draw faint connecting lines. Intensity responds to typing state.

const ctx2d = bgCanvas.getContext("2d");
let bgState = "idle"; // "idle" | "typing" | "error" | "done"
let bgTransitionProgress = 0;

const PARTICLE_COUNT = 55;
const particles = [];

function randomParticle() {
  return {
    x:   Math.random() * bgCanvas.width,
    y:   Math.random() * bgCanvas.height,
    vx:  (Math.random() - 0.5) * 0.28,
    vy:  (Math.random() - 0.5) * 0.28,
    r:   Math.random() * 1.4 + 0.4,
  };
}

function initParticles() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  particles.length = 0;
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(randomParticle());
}

/**
 * Returns the current accent color based on bgState.
 * Particles and lines shift hue to match the typing state.
 */
function getBgColor() {
  switch (bgState) {
    case "typing": return { r: 124, g: 106, b: 247 };
    case "error":  return { r: 245, g: 101, b: 101 };
    case "done":   return { r: 61,  g: 214, b: 140 };
    default:       return { r: 53,  g: 56,  b: 80  };
  }
}

function drawBg() {
  const W = bgCanvas.width;
  const H = bgCanvas.height;

  ctx2d.clearRect(0, 0, W, H);

  // Very faint grid lines in background
  ctx2d.strokeStyle = "rgba(30, 32, 48, 0.9)";
  ctx2d.lineWidth = 0.5;
  const gridSize = 48;
  for (let x = 0; x < W; x += gridSize) {
    ctx2d.beginPath();
    ctx2d.moveTo(x, 0);
    ctx2d.lineTo(x, H);
    ctx2d.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx2d.beginPath();
    ctx2d.moveTo(0, y);
    ctx2d.lineTo(W, y);
    ctx2d.stroke();
  }

  const col = getBgColor();

  // Update and draw particles
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    p.x += p.vx;
    p.y += p.vy;

    // Wrap around edges
    if (p.x < 0)  p.x = W;
    if (p.x > W)  p.x = 0;
    if (p.y < 0)  p.y = H;
    if (p.y > H)  p.y = 0;

    // Draw connections to nearby particles
    for (let j = i + 1; j < particles.length; j++) {
      const q  = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 130;

      if (d < maxDist) {
        const alpha = (1 - d / maxDist) * 0.18;
        ctx2d.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
        ctx2d.lineWidth = 0.6;
        ctx2d.beginPath();
        ctx2d.moveTo(p.x, p.y);
        ctx2d.lineTo(q.x, q.y);
        ctx2d.stroke();
      }
    }

    // Draw particle dot
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx2d.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 0.55)`;
    ctx2d.fill();
  }

  requestAnimationFrame(drawBg);
}

window.addEventListener("resize", () => {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  // Reposition particles within new bounds
  particles.forEach(p => {
    p.x = Math.random() * bgCanvas.width;
    p.y = Math.random() * bgCanvas.height;
  });
});

// ── Helpers ──────────────────────────────────────────────────

/**
 * Pads a number to at least 2 digits.
 * @param {number} n
 * @returns {string}
 */
function addLeadingZero(n) {
  return n < 10 ? "0" + n : String(n);
}

/**
 * Returns a random paragraph, never repeating the last one.
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
 * Applies a state class to the textarea and card, and shifts the
 * background particle color via bgState.
 * @param {string} state - "correct" | "error" | "done" | ""
 */
function setInputState(state) {
  testArea.classList.remove("state-correct", "state-error", "state-done");
  cardInput.classList.remove("state-correct", "state-error", "state-done");
  if (state) {
    testArea.classList.add("state-" + state);
    cardInput.classList.add("state-" + state);
  }

  // Map to bgState for canvas color shift
  const map = { correct: "typing", error: "error", done: "done", "": "idle" };
  bgState = map[state] || "idle";
}

/**
 * Triggers a brief pop animation on a stat value element.
 * @param {HTMLElement} el
 */
function popValue(el) {
  el.classList.remove("pop");
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add("pop");
}

// ── Timer ─────────────────────────────────────────────────────

/**
 * Repaints the timer display.
 */
function updateTimerDisplay() {
  const totalHundredths = Math.floor((Date.now() - startTime) / 10);
  const hundredths   = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds  = totalSeconds % 60;
  const minutes  = Math.floor(totalSeconds / 60);
  timerEl.textContent =
    addLeadingZero(minutes) + ":" +
    addLeadingZero(seconds) + ":" +
    addLeadingZero(hundredths);
}

/**
 * Starts the interval timer on first keystroke.
 */
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startTime = Date.now();
  timerEl.classList.add("running");
  timerInterval = setInterval(updateTimerDisplay, 10);
}

/**
 * Stops the timer and returns elapsed seconds.
 * @returns {number}
 */
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  timerEl.classList.remove("running");
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

// ── Text Matching ─────────────────────────────────────────────

/**
 * Runs on every input event. Starts the timer, counts errors,
 * drives visual state, plays sounds, and detects completion.
 */
function matchText() {
  const typed  = testArea.value;
  const origin = currentText;

  // Start timer on first character
  if (!isRunning && typed.length > 0) startTimer();

  // Play a key click on every new character typed
  playKeyClick();

  // Count mismatched characters
  let errors = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== origin[i]) errors++;
  }

  // Detect a new error event
  if (errors > lastErrorCount) {
    errorCount++;
    lastErrorCount = errors;
    errorDisplay.textContent = errorCount;
    errorDisplay.classList.add("has-errors");
    popValue(errorDisplay);
    playErrorSound();
  } else if (errors < lastErrorCount) {
    // User deleted back past the error; update tracking
    lastErrorCount = errors;
  }

  // Visual state
  if (typed.length === 0) {
    setInputState("");
  } else if (errors > 0 || typed.length > origin.length) {
    setInputState("error");
  } else {
    setInputState("correct");
  }

  // Live WPM
  if (isRunning) {
    const elapsed = (Date.now() - startTime) / 1000;
    const newWPM = calcWPM(typed.length, elapsed);
    if (wpmDisplay.textContent !== String(newWPM)) {
      wpmDisplay.textContent = newWPM;
      popValue(wpmDisplay);
    }
  }

  // Completion
  if (typed === origin) {
    const totalSeconds = stopTimer();
    const finalWPM = calcWPM(origin.length, totalSeconds);

    setInputState("done");
    timerEl.classList.add("done");
    wpmDisplay.textContent = finalWPM;
    testArea.disabled = true;

    // Completion flash + sound
    completionFlash.classList.remove("flash");
    void completionFlash.offsetWidth;
    completionFlash.classList.add("flash");
    playCompleteSound();

    saveScore(totalSeconds, finalWPM);
    renderScores();
  }
}

// ── Local Storage ─────────────────────────────────────────────

/**
 * Loads scores from localStorage.
 * @returns {Array<{time: number, wpm: number}>}
 */
function loadScores() {
  try {
    return JSON.parse(localStorage.getItem("typingScores")) || [];
  } catch { return []; }
}

/**
 * Saves a score, keeping only the top 3 fastest times.
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
 * Renders the top 3 scores into the scoreboard.
 */
function renderScores() {
  const scores = loadScores();
  scoresList.innerHTML = "";

  if (scores.length === 0) {
    scoresList.innerHTML = '<li class="scores-empty">No records yet. Finish a test to set one.</li>';
    return;
  }

  const rankLabels  = ["01", "02", "03"];
  const rankClasses = ["score-rank--first", "score-rank--second", "score-rank--third"];

  scores.forEach((score, i) => {
    const totalHundredths = Math.round(score.time * 100);
    const hundredths = totalHundredths % 100;
    const totalSecs  = Math.floor(totalHundredths / 100);
    const secs       = totalSecs % 60;
    const mins       = Math.floor(totalSecs / 60);
    const timeStr    = addLeadingZero(mins) + ":" + addLeadingZero(secs) + ":" + addLeadingZero(hundredths);

    const li = document.createElement("li");
    li.classList.add("new-score");
    li.style.animationDelay = (i * 0.07) + "s";
    li.innerHTML =
      `<span class="score-rank ${rankClasses[i]}">${rankLabels[i]}</span>` +
      `<span class="score-time">${timeStr}</span>` +
      `<span class="score-wpm">${score.wpm} wpm</span>`;
    scoresList.appendChild(li);
  });
}

// ── Reset ─────────────────────────────────────────────────────

/**
 * Resets all state and UI, loads a fresh random paragraph.
 */
function resetTest() {
  if (isRunning) stopTimer();

  isRunning      = false;
  errorCount     = 0;
  lastErrorCount = 0;
  timerInterval  = null;

  timerEl.textContent      = "00:00:00";
  timerEl.classList.remove("running", "done");
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

// ── Event Listeners ───────────────────────────────────────────

testArea.addEventListener("input", matchText);
resetButton.addEventListener("click", resetTest);

// ── Init ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  currentText = getRandomParagraph();
  originTextEl.textContent = currentText;
  renderScores();
  initParticles();
  drawBg();
});
