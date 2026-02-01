// ===== Config =====
const QUESTIONS_URL = "./questions.json";

const LS_ORDER = "career_test_order_v1";
const LS_ANSWERS = "career_test_answers_v1";
const LS_INDEX = "career_test_index_v1";

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
  // 6 blocos de 10 -> shuffle blocos -> shuffle dentro -> vira ids
  const blocks = chunk(questions, 10);
  const shuffledBlocks = shuffle(blocks);

  const ordered = [];
  for (const block of shuffledBlocks) {
    const shuffledBlock = shuffle(block);
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
    index: parseInt(localStorage.getItem(LS_INDEX) || "0", 10)
  };
}

function saveState(orderIds, answersObj, index) {
  localStorage.setItem(LS_ORDER, JSON.stringify(orderIds));
  localStorage.setItem(LS_ANSWERS, JSON.stringify(answersObj));
  localStorage.setItem(LS_INDEX, String(index));
}

function resetTest() {
  localStorage.removeItem(LS_ORDER);
  localStorage.removeItem(LS_ANSWERS);
  localStorage.removeItem(LS_INDEX);
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

  status.textContent = total
    ? `Progresso: ${pct}%`
    : "";

  fill.style.width = `${pct}%`;
}

function render() {
  const app = document.getElementById("app");
  const { answers, index } = loadState();
  const total = ORDERED.length;

  updateTopUI(index, total);

  if (index >= total) {
    app.innerHTML = `
      <h1>Pronto.</h1>
      <p>Você concluiu as perguntas. Seu resultado pode ser mostrado aqui (por enquanto, estamos só salvando as respostas).</p>
      <p class="muted">Se quiser, clique em “Reiniciar” para testar de novo.</p>
    `;
    return;
  }

  const q = ORDERED[index];
  const options = getOptionsForMode(q.mode);

  // pergunta
  const chosen = (answers[q.id] ?? null);

  app.innerHTML = `
    <h2>${q.text}</h2>
    <div class="btnRow" id="options"></div>
    <div style="height: 10px"></div>
    <div style="display:flex; gap:10px;">
      <button class="smallBtn" id="backBtn" ${index === 0 ? "disabled" : ""}>Voltar</button>
      <div style="flex:1"></div>
      <button class="smallBtn" id="skipBtn">Pular</button>
    </div>
    <p class="muted" style="margin-top: 12px;">Sem pressa. Responda do jeito mais honesto possível.</p>
  `;

  const optWrap = document.getElementById("options");

  options.forEach((label, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = label;

    // marca visual do escolhido
    if (chosen === idx) {
      btn.style.borderColor = "#ffffff";
    }

    btn.addEventListener("click", () => {
      const state = loadState();
      state.answers[q.id] = idx;
      state.index = Math.min(state.index + 1, total);
      saveState(state.order, state.answers, state.index);
      render();
    });

    optWrap.appendChild(btn);
  });

  document.getElementById("backBtn").addEventListener("click", () => {
    const state = loadState();
    state.index = Math.max(state.index - 1, 0);
    saveState(state.order, state.answers, state.index);
    render();
  });

  document.getElementById("skipBtn").addEventListener("click", () => {
    const state = loadState();
    state.index = Math.min(state.index + 1, total);
    saveState(state.order, state.answers, state.index);
    render();
  });
}

async function main() {
  document.getElementById("resetBtn").addEventListener("click", resetTest);

  const res = await fetch(QUESTIONS_URL);
  QUESTIONS = await res.json();

  // validação mínima (pra evitar bug)
  if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 60) {
    alert("questions.json precisa ter exatamente 60 perguntas.");
    return;
  }

  // cria sessão se não existir
  const state = loadState();
  let orderIds = state.order;

  if (!orderIds || orderIds.length !== 60) {
    orderIds = generateControlledOrderIds(QUESTIONS);
    saveState(orderIds, {}, 0);
  }

  ORDERED = buildOrderedQuestions(QUESTIONS, orderIds);
  render();
}

main().catch(err => {
  console.error(err);
  alert("Erro ao carregar o teste. Veja o console.");
});
