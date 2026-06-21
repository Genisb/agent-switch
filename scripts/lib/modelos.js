const CLAUDE_POR_NIVEL = {
  rapido: "haiku",
  equilibrado: "sonnet",
  potente: "opus",
};

const COPILOT_POR_NIVEL = {
  rapido: "claude-haiku-4-5",
  equilibrado: "claude-sonnet-4-6",
  potente: "claude-opus-4-7",
};

const CODEX_POR_NIVEL = {
  rapido: "gpt-5-mini",
  equilibrado: "gpt-5.2-codex",
  potente: "gpt-5.2-codex-max",
};

const COMPOSER_POR_NIVEL = {
  rapido: "composer-2.5-fast",
  equilibrado: "composer-2.5[fast=false]",
  potente: "composer-1.5",
};

function detectarNivel(modelo) {
  if (!modelo) return null;
  const m = String(modelo).toLowerCase();

  if (/haiku|mini|flash|composer-2.5-fast|nano/.test(m)) return "rapido";
  if (/opus|\bo3\b|\bo1\b|composer-1.5|max/.test(m)) return "potente";
  if (/sonnet|gpt-4|gpt-5|[fast=false]|codex/.test(m)) return "equilibrado";
  if (/composer/.test(m)) return "equilibrado";

  return null;
}

function esFamiliaClaude(modelo) {
  return /claude/i.test(String(modelo || ""));
}

function valorUnico(modelo) {
  return Array.isArray(modelo) ? modelo[0] : modelo;
}

export function claudeAcopilot(modeloClaude) {
  const nivel = detectarNivel(modeloClaude);
  return nivel ? COPILOT_POR_NIVEL[nivel] : modeloClaude;
}

export function copilotAclaude(modeloCopilot) {
  const valor = valorUnico(modeloCopilot);

  if (esFamiliaClaude(valor)) {
    const nivel = detectarNivel(valor);
    return nivel ? CLAUDE_POR_NIVEL[nivel] : valor;
  }

  const nivel = detectarNivel(valor);
  return nivel ? CLAUDE_POR_NIVEL[nivel] : valor;
}

export function claudeAcodex(modeloClaude) {
  const nivel = detectarNivel(modeloClaude);
  return nivel ? CODEX_POR_NIVEL[nivel] : modeloClaude;
}

export function copilotAcodex(modeloCopilot) {
  const valor = valorUnico(modeloCopilot);
  const nivel = detectarNivel(valor);
  return nivel ? CODEX_POR_NIVEL[nivel] : valor;
}

export function codexAclaude(modeloCodex) {
  const nivel = detectarNivel(modeloCodex);
  return nivel ? CLAUDE_POR_NIVEL[nivel] : modeloCodex;
}

export function codexAcopilot(modeloCodex) {
  const nivel = detectarNivel(modeloCodex);
  return nivel ? COPILOT_POR_NIVEL[nivel] : modeloCodex;
}

export function claudeAcomposer(modeloClaude) {
  const nivel = detectarNivel(modeloClaude);
  return nivel ? COMPOSER_POR_NIVEL[nivel] : "composer-2";
}

export function copilotAcomposer(modeloCopilot) {
  const valor = valorUnico(modeloCopilot);
  const nivel = detectarNivel(valor);
  return nivel ? COMPOSER_POR_NIVEL[nivel] : "composer-2";
}

export function codexAcomposer(modeloCodex) {
  const nivel = detectarNivel(modeloCodex);
  return nivel ? COMPOSER_POR_NIVEL[nivel] : "composer-2";
}

export function composerAclaude(modeloComposer) {
  const nivel = detectarNivel(modeloComposer);
  return nivel ? CLAUDE_POR_NIVEL[nivel] : CLAUDE_POR_NIVEL.equilibrado;
}

export function composerAcopilot(modeloComposer) {
  const nivel = detectarNivel(modeloComposer);
  return nivel ? COPILOT_POR_NIVEL[nivel] : COPILOT_POR_NIVEL.equilibrado;
}

export function composerAcodex(modeloComposer) {
  const nivel = detectarNivel(modeloComposer);
  return nivel ? CODEX_POR_NIVEL[nivel] : CODEX_POR_NIVEL.equilibrado;
}