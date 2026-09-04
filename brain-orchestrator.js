"use strict";

function normalize(text) {
  return String(text || "").trim();
}

function classify(query) {
  const q = normalize(query).toLowerCase();
  const search = /\b(aujourd'hui|actuel|actualité|dernier|dernière|prix|météo|2026|news|récent|source|google|recherche)\b/.test(q);
  const calculation = /\b(calcul|calcule|combien|équation|dérivée|intégrale|pourcentage)\b/.test(q) || /[0-9]\s*[+\-*/^=]\s*[0-9]/.test(q);
  const code = /\b(code|javascript|python|node|html|css|api|bug|erreur|programm)\b/.test(q);
  const document = /\b(pdf|document|fichier|image|photo|rapport|tableau)\b/.test(q);
  const complex = q.length > 500 || /\b(compare|analyse|expliqu|architecture|plan|stratégie|étape par étape|approfondi)\b/.test(q);
  let task = "chat";
  if (calculation) task = "calculator";
  else if (code) task = "code";
  else if (document) task = "document";
  else if (search) task = "search";
  else if (complex) task = "reasoning";
  return { task, search, verify: complex || search || code, depth: complex ? 3 : 1 };
}

function buildPlan(query, state) {
  const steps = ["comprendre la demande", "rassembler le contexte pertinent"];
  if (state.search) steps.push("utiliser la recherche et vérifier les sources");
  if (state.verify) steps.push("contrôler les points sensibles");
  if (state.task === "calculator") steps.push("effectuer puis vérifier le calcul");
  if (state.task === "code") steps.push("produire une solution exploitable et indiquer ce qui doit être testé");
  if (state.task === "reasoning") steps.push("décomposer le problème et comparer les options");
  steps.push("répondre clairement sans inventer les informations manquantes");
  return steps;
}

function buildInstruction(query, state, context = "") {
  const plan = buildPlan(query, state);
  return `\nORCHESTRATION WIENER IA:\n- Type: ${state.task}\n- Recherche: ${state.search ? "oui" : "non"}\n- Vérification: ${state.verify ? "oui" : "non"}\n- Profondeur: ${state.depth}\n- Plan: ${plan.map((x, i) => `${i + 1}. ${x}`).join("; ")}\n- Règle: distingue faits, contexte, déductions et incertitudes. N'invente ni source, ni résultat d'outil, ni action réalisée.\n${context}`;
}

module.exports = { normalize, classify, buildPlan, buildInstruction };
