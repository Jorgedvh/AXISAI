// ===== Config =====
const QUESTIONS_URL = "./questions.json";

const LS_ORDER = "career_test_order_v1";
const LS_ANSWERS = "career_test_answers_v1";
const LS_INDEX = "career_test_index_v1";
const LS_STARTED = "career_test_started_v1";

const SCALE_I = [
  "Não é verdade pra mim",
  "É um pouco verdade",
  "É bem verdade",
  "É muito verdade"
];

const SCALE_F = [
  "Quase nunca",
  "Às vezes",
  "Geralmente",
  "Quase sempre"
];

// ===== Utils =====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function generateControlledOrderIds(questions) {
  const blocks = chunk(questions, 10);       // 6 blocos de 10
  const shuffledBlocks = shuffle(blocks);    // embaralha blocos

  const ordered = [];
  for (const block of shuffledBlocks) {
    const shuffledBlock = shuffle(block);    // embaralha dentro do bloco
    ordered.push(...shuffledBlock);
  }
  return ordered.map(q => q.id);
}

function getOptionsForMode(mode) {
  return mode === "F" ? SCALE_F : SCALE_I;
}

function loadState() {
  return {
    order: JSON.parse(localStorage.getItem(LS_ORDER) || "[]"),
    answers: JSON.parse(localStorage.getItem(LS_ANSWERS) || "{}"),
    index: parseInt(localStorage.getItem(LS_INDEX) || "0", 10),
    started: localStorage.getItem(LS_STARTED) === "1"
  };
}

function saveState(orderIds, answersObj, index) {
  localStorage.setItem(LS_ORDER, JSON.stringify(orderIds));
  localStorage.setItem(LS_ANSWERS, JSON.stringify(answersObj));
  localStorage.setItem(LS_INDEX, String(index));
}

function setStarted(v) {
  localStorage.setItem(LS_STARTED, v ? "1" : "0");
}

function resetTest() {
  localStorage.removeItem(LS_ORDER);
  localStorage.removeItem(LS_ANSWERS);
  localStorage.removeItem(LS_INDEX);
  localStorage.removeItem(LS_STARTED);
  location.reload();
}

// ===== App =====
let QUESTIONS = [];
let ORDERED = [];

function buildOrderedQuestions(allQuestions, orderIds) {
  const byId = new Map(allQuestions.map(q => [q.id, q]));
  return orderIds.map(id => byId.get(id)).filter(Boolean);
}

function updateTopUI(index, total) {
  const status = document.getElementById("statusText");
  const fill = document.getElementById("progressFill");

  const pct = total ? Math.round((index / total) * 100) : 0;
  status.textContent = total ? `Progresso: ${pct}%` : "Progresso: 0%";
  fill.style.width = `${pct}%`;
}

function renderIntro() {
  const app = document.getElementById("app");
  updateTopUI(0, ORDERED.length);

  app.innerHTML = `
    <h1>AXISAI</h1>
    <h2>Uma conversa rápida para entender seu futuro com menos pressão.</h2>
    <p>Não existe resposta certa. Você não está escolhendo sua profissão agora — só entendendo como você funciona.</p>
    <div class="btnRow" style="margin-top:16px">
      <button class="btn" id="startBtn">Começar</button>
    </div>
    <p class="hint">Duração: ~5–7 minutos. Você pode parar e continuar depois.</p>
  `;

  document.getElementById("startBtn").addEventListener("click", () => {
    setStarted(true);
    render();
  });
}

function renderDone() {
  const app = document.getElementById("app");
  updateTopUI(ORDERED.length, ORDERED.length);

  app.innerHTML = `
    <h1>Pronto.</h1>
    <h2>Você concluiu as perguntas.</h2>
    <p>Por enquanto, o site está salvando suas respostas. O relatório final entra no próximo passo.</p>
    <p class="hint">Se quiser, clique em “Reiniciar” para responder de novo.</p>
  `;
}

function renderQuestion(q, index, total, answers) {
  const app = document.getElementById("app");
  updateTopUI(index, total);

  const options = getOptionsForMode(q.mode);
  const chosen = (answers[q.id] ?? null);

  app.innerHTML = `
    <h2>${q.text}</h2>

    <div class="btnRow" id="options"></div>

    <div class="footerRow">
      <button class="smallBtn" id="backBtn" ${index === 0 ? "disabled" : ""}>Voltar</button>
      <div class="spacer"></div>
      <button class="smallBtn" id="skipBtn">Pular</button>
    </div>

    <p class="hint">Não existe resposta certa. Responda do jeito mais honesto possível.</p>
  `;

  const optWrap = document.getElementById("options");

  options.forEach((label, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = label;

    if (chosen === idx) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      const state = loadState();
      state.answers[q.id] = idx;
      const next = Math.min(state.index + 1, total);
      saveState(state.order, state.answers, next);
      localStorage.setItem(LS_INDEX, String(next));
      render();
    });

    optWrap.appendChild(btn);
  });

  document.getElementById("backBtn").addEventListener("click", () => {
    const state = loadState();
    const prev = Math.max(state.index - 1, 0);
    saveState(state.order, state.answers, prev);
    localStorage.setItem(LS_INDEX, String(prev));
    render();
  });

  document.getElementById("skipBtn").addEventListener("click", () => {
    const state = loadState();
    const next = Math.min(state.index + 1, total);
    saveState(state.order, state.answers, next);
    localStorage.setItem(LS_INDEX, String(next));
    render();
  });
}

function render() {
  const state = loadState();
  const total = ORDERED.length;

  if (!state.started) {
    renderIntro();
    return;
  }

  if (state.index >= total) {
    renderDone();
    return;
  }

  const q = ORDERED[state.index];
  renderQuestion(q, state.index, total, state.answers);
}

async function main() {
  document.getElementById("resetBtn").addEventListener("click", resetTest);

  const res = await fetch(QUESTIONS_URL);
  QUESTIONS = await res.json();

  if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 60) {
    alert("questions.json precisa ter exatamente 60 perguntas.");
    return;
  }

  // init session/order
  const state = loadState();
  let orderIds = state.order;

  if (!orderIds || orderIds.length !== 60) {
    orderIds = generateControlledOrderIds(QUESTIONS);
    saveState(orderIds, {}, 0);
    setStarted(false);
  }

  ORDERED = buildOrderedQuestions(QUESTIONS, orderIds);

  // se index ficou maior que 60 por algum bug antigo
  const current = loadState();
  if (current.index > ORDERED.length) {
    saveState(orderIds, current.answers, 0);
  }

  render();
}

main().catch(err => {
  console.error(err);
  alert("Erro ao carregar o teste. Veja o console.");
});

