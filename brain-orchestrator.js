"use strict";

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function classify(query) {
  const q = normalize(query).toLowerCase();
  const search = /\b(aujourd'hui|actuel|actuelle|actualité|actualités|dernier|dernière|récent|récente|prix|météo|2026|news|source|sources|google|recherche|internet|web|maintenant)\b/.test(q);
  const calculation = /\b(calcul|calcule|calculer|combien|équation|dérivée|intégrale|pourcentage|statistique|conversion|moyenne|variance|écart-type)\b/.test(q) || /[0-9]\s*[+\-*/^=]\s*[0-9]/.test(q);
  const code = /\b(code|javascript|python|node|html|css|api|bug|erreur|programm|git|github|sql|backend|frontend|serveur|déploiement)\b/.test(q);
  const document = /\b(pdf|document|fichier|image|photo|rapport|tableau|excel|csv|capture|screenshot)\b/.test(q);
  const data = /\b(csv|excel|xlsx|données|data|dataset|statistiques|graphique|graphe|anomalie|corrélation)\b/.test(q);
  const image = /\b(image|illustration|dessine|génère.*image|diagramme|logo|visuel)\b/.test(q);
  const education = /\b(exercice|devoir|cours|leçon|révision|bac|concours|maths|physique|chimie|svt|anglais|français|histoire|géographie)\b/.test(q);
  const complex = q.length > 500 || /\b(compare|comparaison|analyse|analyser|expliqu|architecture|plan|stratégie|étape par étape|approfondi|complet|optimise|améliore|audit|recherche.*compare)\b/.test(q);
  const ambiguity = q.length < 8 || /^(ça|cela|lui|elle|oui|non|et|encore|pareil|continue|fais-le|fais ca|ok)$/i.test(q);
  let task = "chat";
  if (calculation) task = "calculator";
  else if (code) task = "code";
  else if (document) task = "document";
  else if (data) task = "data";
  else if (image) task = "image";
  else if (education) task = "education";
  else if (search) task = "search";
  else if (complex) task = "reasoning";
  const verify = complex || search || code || calculation || data || document;
  const tools = [];
  if (search) tools.push("googleSearch");
  if (calculation) tools.push("calculator");
  if (document) tools.push("fileAnalysis");
  if (data) tools.push("dataAnalysis");
  if (image) tools.push("imageGeneration");
  if (code) tools.push("code");
  if (tools.length === 0) tools.push("languageModel");
  return {
    task, search, verify, ambiguity,
    depth: complex ? 4 : verify ? 2 : 1,
    tools,
    confidence: ambiguity ? 0.45 : complex ? 0.82 : 0.92
  };
}

function buildPlan(query, state) {
  const steps = [
    "comprendre l'intention et le contexte",
    "récupérer les éléments pertinents de la mémoire et du contexte"
  ];
  if (state.ambiguity) steps.push("interpréter le contexte disponible et éviter une hypothèse injustifiée");
  if (state.search) steps.push("rechercher les informations actuelles et comparer les sources");
  if (state.tools.includes("fileAnalysis")) steps.push("inspecter le contenu du fichier et extraire les éléments utiles");
  if (state.tools.includes("dataAnalysis")) steps.push("contrôler les données, calculer les indicateurs et rechercher les anomalies");
  if (state.task === "calculator") steps.push("effectuer puis vérifier le calcul");
  if (state.task === "code") steps.push("produire une solution exploitable et contrôler les erreurs évidentes");
  if (state.task === "reasoning") steps.push("décomposer le problème, tester les hypothèses et comparer les options");
  if (state.verify) steps.push("vérifier cohérence, calculs, sources, contradictions et limites");
  steps.push("synthétiser une réponse claire, proportionnée et traçable");
  return [...new Set(steps)];
}

function buildInstruction(query, state, context = "") {
  const plan = buildPlan(query, state);
  return `\nORCHESTRATION WIENER IA:\n- Type: ${state.task}\n- Outils candidats: ${state.tools.join(", ")}\n- Recherche Web: ${state.search ? "requise" : "non requise a priori"}\n- Vérification: ${state.verify ? "requise" : "proportionnelle au risque"}\n- Ambiguïté détectée: ${state.ambiguity ? "oui" : "non"}\n- Confiance initiale: ${state.confidence}\n- Profondeur: ${state.depth}\n- Plan: ${plan.map((x, i) => `${i + 1}. ${x}`).join("; ")}\n- Règles: distingue faits, contexte, déductions et incertitudes. Utilise les outils réellement disponibles. N'invente ni source, ni résultat d'outil, ni action réalisée. Si une information manque, signale-la plutôt que de la fabriquer.\n${context}`;
}

function verifyResponse(answer, state = {}) {
  const text = normalize(answer);
  const issues = [];
  if (!text) issues.push("réponse vide");
  if (/je viens de rechercher|j'ai vérifié|j'ai exécuté|j'ai testé/i.test(text) && !state.tools?.includes("googleSearch") && !state.tools?.includes("code")) {
    issues.push("affirmation d'une action externe non établie");
  }
  if (state.search && !/source|selon|référence|citation|http/i.test(text)) issues.push("réponse de recherche sans indication de source visible");
  if (state.task === "calculator" && !/[0-9]/.test(text)) issues.push("résultat numérique absent");
  return { ok: issues.length === 0, issues, checkedAt: new Date().toISOString() };
}

module.exports = { normalize, classify, buildPlan, buildInstruction, verifyResponse };
