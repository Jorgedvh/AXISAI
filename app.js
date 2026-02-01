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
// =========================
// RELATÓRIO (do jeito combinado)
// =========================

// Converte escolha (0..3) em intensidade (-2,-1,+1,+2)
function scoreFromChoice(choice) {
  const map = [-2, -1, +1, +2];
  return map[choice] ?? 0;
}

// Eixos:
// EI: + = Extroversão, - = Introversão
// PF: + = Pessoas, - = Sistemas
// RS: + = Risco/novidade, - = Estabilidade/segurança
// AS: + = Ação/velocidade, - = Profundidade/planejamento
// ST: + = Estrutura/regras, - = Flexibilidade/autonomia
// CO: + = Competição, - = Cooperação
const MAP = {
  1:  { EI: -1 },  2:  { EI: +1 },  3:  { EI: -1 },  4:  { EI: +1 },
  5:  { AS: -1 },  6:  { EI: +1 },  7:  { AS: -1 },  8:  { EI: +1 },
  9:  { RS: -1, ST: +1 }, 10:{ RS: +1, ST: -1 },

  11: { AS: -1, ST: +1 }, 12:{ RS: +1 }, 13:{ AS: -1 }, 14:{ AS: +1, RS:+1 },
  15: { PF: -1 }, 16:{ PF: +1 }, 17:{ ST: +1 }, 18:{ ST: -1 },
  19: { AS: +1 }, 20:{ RS: +1 },

  21: { AS: +1 }, 22:{ RS: -1 }, 23:{ RS: +1 }, 24:{ RS: -1 },
  25: { RS: +1 }, 26:{ ST: +1 }, 27:{ ST: -1, RS:+1 },
  28: { CO: +1 }, 29:{ CO: -1 }, 30:{ RS: +1 },

  31: { PF: +1 }, 32:{ PF: +1 }, 33:{ PF: -1 }, 34:{ PF:+1 },
  35: { PF: -1 }, 36:{ PF: +1 }, 37:{ PF:+1 }, 38:{ PF:+1 },
  39: { PF: +1 }, 40:{ EI:+1, PF:+1 },

  41: { AS:+1 }, 42:{ PF:-1, AS:-1 }, 43:{ RS:+1 }, 44:{ AS:+1 },
  45: { RS:+1 }, 46:{ AS:+1 }, 47:{ RS:+1, AS:-1 }, 48:{ AS:+1 },
  49: { ST:+1, AS:-1 }, 50:{ AS:-1 },

  51: { ST:+1 }, 52:{ ST:+1 }, 53:{ EI:+1, CO:+1 },
  54: { PF:-1 }, 55:{ PF:+1 }, 56:{ ST:+1 },
  57: { RS:-1 }, 58:{ RS:+1 }, 59:{ RS:+1 }, 60:{ RS:+1, ST:-1 }
};

function computeAxes(questions, answers) {
  const axes = { EI:0, PF:0, RS:0, AS:0, ST:0, CO:0 };
  for (const q of questions) {
    const choice = answers[q.id];
    if (choice === undefined || choice === null) continue;
    const base = scoreFromChoice(choice);
    const m = MAP[q.id];
    if (!m) continue;
    for (const k of Object.keys(m)) axes[k] += base * m[k];
  }
  return axes;
}

// DISC (Cercado de Idiotas): Azul/Amarelo/Vermelho/Verde
function discFromAxes(a) {
  const vermelho = (a.AS * 1.2) + (a.CO * 1.0) + (a.RS * 0.8);
  const amarelo  = (a.EI * 1.1) + (a.PF * 1.0) + (a.RS * 0.5);
  const azul     = (-a.PF * 1.1) + (a.ST * 0.9) + (-a.AS * 0.7);
  const verde    = (-a.CO * 1.0) + (-a.RS * 0.9) + (a.ST * 0.6);

  const scores = [
    { color:"Vermelho", v:vermelho },
    { color:"Amarelo",  v:amarelo  },
    { color:"Azul",     v:azul     },
    { color:"Verde",    v:verde    }
  ].sort((x,y)=> y.v - x.v);

  return { primary: scores[0], secondary: scores[1], all: scores };
}

// MBTI simplificado (proxy)
function mbtiFromAxes(a) {
  const E = a.EI >= 0 ? "E" : "I";
  const N = a.RS >= 0 ? "N" : "S";
  const F = a.PF >= 0 ? "F" : "T";
  const J = a.ST >= 0 ? "J" : "P";
  return `${E}${N}${F}${J}`;
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function confidenceScore(totalQuestions, answers, axes) {
  const answered = Object.keys(answers || {}).length;
  const completion = answered / totalQuestions;

  const magnitude = (Math.abs(axes.EI)+Math.abs(axes.PF)+Math.abs(axes.RS)+Math.abs(axes.AS)+Math.abs(axes.ST)+Math.abs(axes.CO)) / 60;
  const mag01 = clamp01(magnitude / 1.8);

  return Math.round(100 * (0.55*completion + 0.45*mag01));
}

// ====== RELATÓRIO HUMANO (tom combinado) ======
function reportCopy(discPrimary, discSecondary, mbti, a) {
  const primary = discPrimary.color;
  const secondary = discSecondary.color;

  const prefersPeople = a.PF > 0;
  const prefersFast = a.AS > 0;
  const prefersRisk = a.RS > 0;
  const prefersStructure = a.ST > 0;
  const moreCompetitive = a.CO > 0;

  const openingByColor = {
    Vermelho: [
      "Você não é feito pra ficar parado.",
      "Você funciona melhor com desafio, meta e avanço visível.",
      "Quando tem objetivo, você vira outra pessoa."
    ],
    Amarelo: [
      "Você cresce quando tem gente, troca e movimento.",
      "Sua energia vem do ambiente e das conversas certas.",
      "Quando você tá animado, você rende muito."
    ],
    Azul: [
      "Você não gosta de fazer por fazer. Você gosta de entender.",
      "Você rende quando tem clareza, lógica e qualidade.",
      "Você é do tipo que melhora tudo quando leva a sério."
    ],
    Verde: [
      "Você rende mais quando tem constância e paz mental.",
      "Você é forte no que é estável, bem feito e sustentável.",
      "Quando o ambiente é saudável, você evolui muito."
    ]
  };

  const strengthsByColor = {
    Vermelho: ["execução e coragem pra decidir", "foco em resultado", "liderança na prática"],
    Amarelo: ["comunicação e influência", "criatividade e ideias", "mover pessoas e projetos"],
    Azul: ["profundidade e raciocínio", "padrão alto / qualidade", "resolver problema difícil com calma"],
    Verde: ["consistência e responsabilidade", "trabalho em equipe sem ego", "crescimento de longo prazo"]
  };

  const pitfallsByColor = {
    Vermelho: ["se irritar com lentidão", "se cobrar demais", "perder paciência com gente lenta"],
    Amarelo: ["dispersar quando vira rotina", "começar várias coisas e cansar no meio", "depender do clima pra render"],
    Azul: ["perfeccionismo que trava", "pensar demais e agir menos", "se desgastar com bagunça"],
    Verde: ["evitar mudança", "engolir incômodo", "ficar tempo demais no confortável"]
  };

  let hiddenStrength = "";
  if (!prefersPeople && prefersStructure && !prefersFast) {
    hiddenStrength = "Você tem um perfil raro de foco e profundidade. Isso vira vantagem absurda quando você escolhe um caminho bom e sustenta o processo.";
  } else if (prefersPeople && prefersFast) {
    hiddenStrength = "Você tem uma habilidade natural de puxar energia do ambiente e transformar em movimento. Se você aprender constância, você cresce muito rápido.";
  } else if (prefersRisk && prefersFast) {
    hiddenStrength = "Você tem coragem de testar e não fica preso no medo. Se você cria um método simples, você vira alguém muito acima da média.";
  } else if (!prefersRisk && prefersStructure) {
    hiddenStrength = "Você tem maturidade para construir com calma. Isso dá estabilidade e confiança no futuro — quando você acerta um caminho, você evolui sem se perder.";
  } else {
    hiddenStrength = "Você tem mais padrão do que parece. Não é aleatório — só precisa do ambiente certo pra aparecer forte.";
  }

  const happyEnv = [];
  const painEnv = [];

  happyEnv.push(prefersPeople ? "troca com pessoas, conversa e alinhamento" : "foco, autonomia e tempo para pensar");
  happyEnv.push(prefersFast ? "ritmo que anda, com entrega e progresso" : "ritmo estável, com tempo para fazer bem feito");
  happyEnv.push(prefersStructure ? "expectativa clara, processo e organização" : "liberdade pra explorar e decidir como fazer");
  happyEnv.push(prefersRisk ? "espaço pra testar e errar sem drama" : "previsibilidade e estabilidade");

  painEnv.push(prefersPeople ? "ficar isolado por muito tempo, sem troca" : "muita exposição social o tempo inteiro");
  painEnv.push(prefersFast ? "ambiente lento, sem decisão e sem avanço" : "urgência o tempo inteiro e cobrança caótica");
  painEnv.push(prefersStructure ? "bagunça e meta confusa" : "microgerenciamento e regra pra tudo");
  painEnv.push(moreCompetitive ? "grupo sem fome / sem meta" : "competição tóxica e clima de guerra");

  const T = (title, why, examples, test7) => ({ title, why, examples, test7 });
  let tracks = [];

  if (primary === "Azul") {
    tracks = [
      T("Construir e resolver (lógica + profundidade)",
        "Você tende a ser muito bom quando existe um problema real pra entender e destrinchar.",
        prefersPeople ? ["Produto (PM) com base técnica", "UX Research", "Data/BI para negócio"] : ["Engenharia de software", "Ciência de dados", "Engenharia (geral)"],
        "7 dias: escolha um problema (app/site/escola). Escreva 3 hipóteses, 3 melhorias e teste 1 com alguém. Sem perfeição — só entrega."
      ),
      T("Ciência aplicada (entender como o mundo funciona)",
        "Pode combinar com você um caminho que mistura teoria com aplicação.",
        ["Engenharia biomédica", "Bioinformática", "Pesquisa aplicada", "Tecnologia na saúde"],
        "7 dias: escolha um tema. Use 3 fontes boas e escreva 1 página: o que é, por que importa, como vira trabalho."
      ),
      T("Qualidade e sistemas (organizar o caos)",
        "Seu diferencial pode ser deixar as coisas sólidas e bem feitas.",
        ["Qualidade", "Processos", "Operações", "Engenharia de produção"],
        "7 dias: pegue um processo seu (estudo/treino). Crie checklist + rotina + 1 métrica. Veja se sua mente fica mais leve."
      )
    ];
  } else if (primary === "Amarelo") {
    tracks = [
      T("Comunicação e influência (pessoas + movimento)",
        "Você tende a render quando tem troca, palco e energia.",
        ["Marketing", "Conteúdo", "Comunicação", "Relações públicas"],
        "7 dias: crie 3 conteúdos curtos ensinando algo. Regra: alguém precisa entender sem te perguntar nada."
      ),
      T("Negócios com relacionamento (conversa que vira resultado)",
        "Áreas onde conversar bem é parte do trabalho podem encaixar muito.",
        ["Vendas consultivas", "Customer Success", "Parcerias", "Comunidade"],
        "7 dias: faça 5 mini-entrevistas sobre um problema real. Depois escreva uma solução em 10 linhas."
      ),
      T("Projetos com causa (impacto direto)",
        "Você tende a ficar mais feliz quando vê impacto humano real.",
        ["Projetos sociais", "Educação", "Liderança comunitária", "ONGs"],
        "7 dias: participe de 1 ação. Anote: o que te deu energia? o que drenou? Isso te mostra caminho."
      )
    ];
  } else if (primary === "Vermelho") {
    tracks = [
      T("Execução e liderança prática (meta + entrega)",
        "Você tende a ficar bem quando existe objetivo e responsabilidade real.",
        ["Empreendedorismo", "Gestão de projetos", "Operações"],
        "7 dias: lidera um mini-projeto com entrega clara. Um começo, meio e fim."
      ),
      T("Performance e métrica (crescimento real)",
        "Você gosta de ver resultado e ajustar rápido.",
        ["Growth", "Vendas", "Operações orientadas a números"],
        "7 dias: escolha uma meta mensurável. Mede todo dia e ajusta. Sem drama, só dado."
      ),
      T("Tecnologia aplicada (construir rápido)",
        "Se você curte construir e ver funcionando, isso pode virar trilha.",
        ["Dev", "Automação", "Apps simples"],
        "7 dias: construa algo pequeno funcionando e mostre pra 3 pessoas. Pega feedback e melhora."
      )
    ];
  } else { // Verde
    tracks = [
      T("Cuidado e desenvolvimento (gente + constância)",
        "Você tende a ser forte em construir pessoas e ambientes saudáveis.",
        ["Educação", "Psicologia (futuro)", "People/RH", "Mentoria"],
        "7 dias: observe 5 momentos em que você ajudou alguém. Você saiu melhor ou drenado? Isso mostra seu tipo de impacto."
      ),
      T("Gestão e estabilidade (crescer sem caos)",
        "Você pode render muito em áreas consistentes e bem estruturadas.",
        ["Administração", "Gestão", "Qualidade", "Operações"],
        "7 dias: crie uma rotina mínima (sono/estudo/treino). Objetivo: sentir a mente ficando mais estável."
      ),
      T("Saúde e bem-estar (impacto humano direto)",
        "Caminhos que melhoram a vida das pessoas podem te dar sentido real.",
        ["Fisioterapia", "Nutrição (futuro)", "Educação física"],
        "7 dias: acompanhe sono/energia/humor. Descubra o que te melhora e o que te derruba. Isso define escolhas melhores."
      )
    ];
  }

  const howToUse = [
    "Você não precisa decidir sua vida agora.",
    "Você só precisa escolher uma trilha pra explorar primeiro.",
    "Teste na vida real antes de bater martelo. É assim que você tira o medo."
  ];

  return {
    primary, secondary, mbti,
    opening: openingByColor[primary] || openingByColor.Azul,
    strengths: strengthsByColor[primary] || strengthsByColor.Azul,
    pitfalls: pitfallsByColor[primary] || pitfallsByColor.Azul,
    hiddenStrength,
    happyEnv, painEnv,
    tracks, howToUse
  };
}

function buildReportHTML(r, conf) {
  const list = (items) => items.map(x => `<li>${x}</li>`).join("");
  const bullets = (items) => items.map(x => `<div style="margin-top:6px;">• ${x}</div>`).join("");

  const trackCards = r.tracks.map(t => `
    <div style="border:1px solid var(--line); border-radius:14px; padding:12px; background:rgba(255,255,255,.04); margin-top:10px;">
      <div style="font-weight:800; font-size:16px; margin-bottom:6px;">${t.title}</div>
      <div style="color:var(--muted); font-size:14px; line-height:1.45;">
        <div><b>Por quê combina:</b> ${t.why}</div>
        <div style="margin-top:6px;"><b>Exemplos:</b> ${t.examples.join(", ")}</div>
        <div style="margin-top:8px;"><b>Teste prático (7 dias):</b> ${t.test7}</div>
      </div>
    </div>
  `).join("");

  return `
    <h1>Relatório AXISAI</h1>
    <h2>${r.opening[0]}</h2>
    <p>${r.opening[1]} ${r.opening[2]}</p>

    <p class="hint" style="margin-top:12px;">
      Base: <b>${r.primary}</b> (secundário: <b>${r.secondary}</b>) • MBTI (proxy): <b>${r.mbti}</b> • confiança: <b>${conf}%</b>
    </p>

    <div style="margin-top:14px;">
      <h1>Seu jeito natural</h1>
      <div style="color:var(--muted); font-size:14px; line-height:1.55;">
        <div><b>Você tende a ser forte em:</b>${bullets(r.strengths)}</div>
        <div style="margin-top:10px;"><b>Cuidado com:</b>${bullets(r.pitfalls)}</div>
      </div>
    </div>

    <div style="margin-top:14px;">
      <h1>Onde você tende a ser mais feliz</h1>
      <ul style="margin:8px 0 0; color:var(--muted); line-height:1.55;">${list(r.happyEnv)}</ul>
    </div>

    <div style="margin-top:14px;">
      <h1>Onde você tende a sofrer (pra evitar escolha errada)</h1>
      <ul style="margin:8px 0 0; color:var(--muted); line-height:1.55;">${list(r.painEnv)}</ul>
    </div>

    <div style="margin-top:14px;">
      <h1>O que você talvez não esteja enxergando</h1>
      <p>${r.hiddenStrength}</p>
    </div>

    <div style="margin-top:14px;">
      <h1>3 trilhas de futuro (não é decisão agora)</h1>
      <p>Escolha <b>uma</b> trilha pra explorar primeiro. Você vai validar na prática, sem medo de errar.</p>
      ${trackCards}
    </div>

    <div style="margin-top:14px;">
      <h1>Como usar isso sem ansiedade</h1>
      <div style="color:var(--muted); font-size:14px; line-height:1.55;">
        ${bullets(r.howToUse)}
      </div>
    </div>

    <div class="btnRow" style="margin-top:16px;">
      <button class="btn" id="restartBtn">Refazer (do zero)</button>
    </div>

    <p class="hint" style="margin-top:10px;">
      Importante: isso não define você. Isso só te dá direção com menos erro.
    </p>
  `;
}
function renderDone() {
  const app = document.getElementById("app");
  updateTopUI(ORDERED.length, ORDERED.length);

  const state = loadState();

  const axes = computeAxes(QUESTIONS, state.answers);
  const disc = discFromAxes(axes);
  const mbti = mbtiFromAxes(axes);
  const conf = confidenceScore(QUESTIONS.length, state.answers, axes);

  const report = reportCopy(disc.primary, disc.secondary, mbti, axes);
  app.innerHTML = buildReportHTML(report, conf);

  document.getElementById("restartBtn").addEventListener("click", () => resetTest());
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
