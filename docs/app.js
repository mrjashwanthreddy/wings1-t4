/* Spring Boot Wings 1 Timed Quiz */

const SETTINGS = {
  totalPerQuiz: 50,
  multiPerQuiz: 5,           // out of total
  secondsPerQuestion: 120,   // 2 minutes
  mix: { easy: 0.40, medium: 0.45, hard: 0.15 },
  storageKey: 'wings1-quiz-state-v1'
};

const els = {
  startBtn: document.getElementById('startBtn'),
  mode: document.getElementById('mode'),
  count: document.getElementById('count'),
  statusBar: document.getElementById('statusBar'),
  qIndex: document.getElementById('qIndex'),
  qTotal: document.getElementById('qTotal'),
  timer: document.getElementById('timer'),
  progress: document.getElementById('progress'),
  quiz: document.getElementById('quiz'),
  questionMeta: document.getElementById('questionMeta'),
  questionText: document.getElementById('questionText'),
  optionsForm: document.getElementById('optionsForm'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  skipBtn: document.getElementById('skipBtn'),
  submitBtn: document.getElementById('submitBtn'),
  result: document.getElementById('result'),
  scoreSummary: document.getElementById('scoreSummary'),
  breakdown: document.getElementById('breakdown'),
  reviewBtn: document.getElementById('reviewBtn'),
  reviewPanel: document.getElementById('reviewPanel'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  loading: document.getElementById('loading'),
};

let ALL_QUESTIONS = [];
let state = null;
let timerId = null;

function secondsToMMSS(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function groupBy(arr, key) {
  return arr.reduce((m, x) => {
    const k = typeof key === 'function' ? key(x) : x[key];
    m[k] = m[k] || [];
    m[k].push(x);
    return m;
  }, {});
}
function saveState() {
  if (state) localStorage.setItem(SETTINGS.storageKey, JSON.stringify(state));
}
function loadState() {
  const raw = localStorage.getItem(SETTINGS.storageKey);
  return raw ? JSON.parse(raw) : null;
}
function clearState() {
  localStorage.removeItem(SETTINGS.storageKey);
}

async function loadQuestions() {
  const res = await fetch('questions.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load questions.json');
  return res.json();
}

function pickQuestions(all, total, mix) {
  const byDifficulty = groupBy(all, 'difficulty'); // easy/medium/hard
  const counts = {
    easy: Math.round(total * mix.easy),
    medium: Math.round(total * mix.medium),
    hard: total - (Math.round(total * mix.easy) + Math.round(total * mix.medium)),
  };
  let picked = [];
  ['easy', 'medium', 'hard'].forEach(d => {
    const pool = byDifficulty[d] || [];
    picked = picked.concat(shuffle(pool).slice(0, counts[d]));
  });
  if (picked.length > total) picked = picked.slice(0, total);
  if (picked.length < total) {
    const remaining = shuffle(all.filter(q => !picked.includes(q))).slice(0, total - picked.length);
    picked = picked.concat(remaining);
  }
  return shuffle(picked).map((q, i) => ({
    ...q,
    idx: i,
    options: shuffle(q.options),
    answer: null,
    timeLeft: SETTINGS.secondsPerQuestion,
    status: 'unseen'
  }));
}

function renderQuestion() {
  const q = state.questions[state.current];
  els.qIndex.textContent = (state.current + 1);
  els.qTotal.textContent = state.total.toString();
  els.questionMeta.innerHTML = `
    <span class="tag topic">${q.topic}</span>
    <span class="tag diff ${q.difficulty}">${q.difficulty}</span>
    <span class="tag type">${q.type === 'mc-multi' ? 'Multiple correct' : 'Single correct'}</span>
  `;
  els.questionText.textContent = q.text;
  els.optionsForm.innerHTML = '';

  const isMulti = q.type === 'mc-multi';
  q.options.forEach((opt, i) => {
    const id = `opt_${q.idx}_${i}`;
    const input = document.createElement('input');
    input.type = isMulti ? 'checkbox' : 'radio';
    input.name = `q_${q.idx}`;
    input.id = id;
    input.value = opt.id;
    if (q.answer) {
      if (isMulti && Array.isArray(q.answer) && q.answer.includes(opt.id)) input.checked = true;
      if (!isMulti && q.answer === opt.id) input.checked = true;
    }
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.innerHTML = `<span class="opt-key">${String.fromCharCode(65 + i)}.</span> ${opt.text}`;
    const line = document.createElement('div');
    line.className = 'option';
    line.appendChild(input);
    line.appendChild(label);
    els.optionsForm.appendChild(line);
  });

  updateProgress();
}

function collectAnswer() {
  const q = state.questions[state.current];
  const isMulti = q.type === 'mc-multi';
  if (isMulti) {
    const checked = Array.from(els.optionsForm.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
    q.answer = checked.length ? checked : null;
  } else {
    const checked = els.optionsForm.querySelector('input[type="radio"]:checked');
    q.answer = checked ? checked.value : null;
  }
  q.status = q.answer ? 'answered' : q.status;
  saveState();
}

function updateProgress() {
  const answered = state.questions.filter(q => q.status === 'answered').length;
  const skipped = state.questions.filter(q => q.status === 'skipped').length;
  els.progress.textContent = `Answered: ${answered} | Skipped: ${skipped}`;
}

function startTimersIfNeeded() {
  if (state.mode !== 'timed') {
    els.timer.textContent = '—';
    return;
  }
  stopTimer();
  tickTimer();
  timerId = setInterval(tickTimer, 1000);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
function tickTimer() {
  const q = state.questions[state.current];
  if (q.timeLeft <= 0) {
    q.status = q.status === 'answered' ? 'answered' : 'skipped';
    nextQuestion();
    return;
  }
  q.timeLeft -= 1;
  els.timer.textContent = secondsToMMSS(q.timeLeft);
  saveState();
}

function prevQuestion() { collectAnswer(); if (state.current > 0) { state.current -= 1; saveState(); renderQuestion(); startTimersIfNeeded(); } }
function nextQuestion() { collectAnswer(); if (state.current < state.total - 1) { state.current += 1; saveState(); renderQuestion(); startTimersIfNeeded(); } else { showResult(); } }
function skipQuestion() { const q = state.questions[state.current]; q.status = 'skipped'; nextQuestion(); }

function scoreQuiz() {
  let correct = 0, total = state.total;
  const perTopic = {}, perDiff = {};
  state.questions.forEach(q => {
    const isMulti = q.type === 'mc-multi';
    let ok = false;
    if (isMulti) {
      const a = Array.isArray(q.answer) ? q.answer.slice().sort() : [];
      const c = q.correct.slice().sort();
      ok = a.length > 0 && JSON.stringify(a) === JSON.stringify(c);
    } else {
      ok = q.answer === q.correct[0];
    }
    if (ok) correct += 1;
    perTopic[q.topic] = perTopic[q.topic] || { correct: 0, total: 0 };
    perTopic[q.topic].total += 1; perTopic[q.topic].correct += ok ? 1 : 0;
    perDiff[q.difficulty] = perDiff[q.difficulty] || { correct: 0, total: 0 };
    perDiff[q.difficulty].total += 1; perDiff[q.difficulty].correct += ok ? 1 : 0;
    q.ok = ok;
  });
  return { correct, total, perTopic, perDiff };
}

function showResult() {
  stopTimer();
  state.completed = true;
  saveState();

  els.quiz.classList.add('hidden');
  els.statusBar.classList.add('hidden');
  els.result.classList.remove('hidden');

  const { correct, total, perTopic, perDiff } = scoreQuiz();
  els.scoreSummary.innerHTML = `
    <div class="score">Score: <strong>${correct}/${total}</strong> (${Math.round((correct / total) * 100)}%)</div>
    <div>Time: ${Math.round((Date.now() - state.startedAt) / 1000)}s</div>
  `;
  const topicHtml = Object.entries(perTopic)
    .map(([t, v]) => `<li>${t}: ${v.correct}/${v.total} (${Math.round((v.correct / v.total) * 100)}%)</li>`)
    .join('');
  const diffHtml = Object.entries(perDiff)
    .map(([d, v]) => `<li>${d}: ${v.correct}/${v.total} (${Math.round((v.correct / v.total) * 100)}%)</li>`)
    .join('');
  els.breakdown.innerHTML = `
    <h3>By Topic</h3><ul>${topicHtml}</ul>
    <h3>By Difficulty</h3><ul>${diffHtml}</ul>
  `;

  const review = state.questions.map((q, i) => {
    const isMulti = q.type === 'mc-multi';
    const userAns = isMulti ? (q.answer || []) : [q.answer].filter(Boolean);
    const correctSet = new Set(q.correct);
    const uaSet = new Set(userAns);
    const optionsHtml = q.options.map((o, idx) => {
      const isCorrect = correctSet.has(o.id);
      const chosen = uaSet.has(o.id);
      const cls = isCorrect ? 'correct' : (chosen ? 'chosen' : '');
      return `<li class="${cls}"><span class="opt-key">${String.fromCharCode(65 + idx)}.</span> ${o.text}</li>`;
    }).join('');
    return `
      <div class="review-item ${q.ok ? 'ok' : 'bad'}">
        <div class="meta">
          <span>#${i + 1}</span>
          <span class="tag topic">${q.topic}</span>
          <span class="tag diff ${q.difficulty}">${q.difficulty}</span>
          <span class="tag type">${q.type === 'mc-multi' ? 'Multiple' : 'Single'}</span>
        </div>
        <div class="q">${q.text}</div>
        <ul class="options">${optionsHtml}</ul>
        ${q.expl ? `<div class="expl"><strong>Explanation:</strong> ${q.expl}</div>` : ''}
      </div>
    `;
  }).join('');
  els.reviewPanel.innerHTML = review;
}

function exportCsv() {
  const rows = [
    ['Index', 'Topic', 'Difficulty', 'Type', 'Correct', 'Chosen', 'IsCorrect', 'TimeLeft'],
    ...state.questions.map((q, i) => {
      const isMulti = q.type === 'mc-multi';
      const chosen = isMulti ? (q.answer || []).join('|') : (q.answer || '');
      const correct = q.correct.join('|');
      return [i + 1, q.topic, q.difficulty, q.type, correct, chosen, q.ok ? '1' : '0', q.timeLeft];
    })
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quiz-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  els.startBtn.addEventListener('click', () => {
    const mode = els.mode.value;
    const desiredCount = parseInt(els.count.value || '50', 10);
    const total = Math.min(Math.max(desiredCount, 10), Math.min(50, ALL_QUESTIONS.length));
    const selected = pickQuestions(ALL_QUESTIONS, total, SETTINGS.mix);
    state = { mode, total, current: 0, questions: selected, startedAt: Date.now(), completed: false };
    els.loading.classList.add('hidden');
    els.statusBar.classList.remove('hidden');
    els.quiz.classList.remove('hidden');
    els.result.classList.add('hidden');
    renderQuestion();
    startTimersIfNeeded();
  });
  els.prevBtn.addEventListener('click', prevQuestion);
  els.nextBtn.addEventListener('click', nextQuestion);
  els.skipBtn.addEventListener('click', skipQuestion);
  els.submitBtn.addEventListener('click', showResult);
  els.reviewBtn.addEventListener('click', () => els.reviewPanel.classList.toggle('hidden'));
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.optionsForm.addEventListener('change', () => collectAnswer());
}

(async function boot() {
  try {
    ALL_QUESTIONS = await loadQuestions();
    els.loading.textContent = `Loaded ${ALL_QUESTIONS.length} questions. Configure and start your quiz.`;
  } catch (e) {
    els.loading.textContent = 'Failed to load questions.json';
    console.error(e);
  }
  wireEvents();

  const saved = loadState();
  if (saved && !saved.completed) {
    state = saved;
    els.loading.classList.add('hidden');
    els.statusBar.classList.remove('hidden');
    els.quiz.classList.remove('hidden');
    renderQuestion();
    startTimersIfNeeded();
  }
})();