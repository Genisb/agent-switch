import fs from "node:fs";
import path from "node:path";

const DIR_CLAUDE = path.join(".claude", "skills");
const DIR_COPILOT = path.join(".github", "skills");
const DIR_CODEX = path.join(".codex", "skills");
const DIR_COMPOSER = path.join(".cursor", "skills");

function copiarCarpeta(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });

  for (const entrada of fs.readdirSync(origen, { withFileTypes: true })) {
    const rutaOrigen = path.join(origen, entrada.name);
    const rutaDestino = path.join(destino, entrada.name);

    if (entrada.isDirectory()) {
      copiarCarpeta(rutaOrigen, rutaDestino);
    } else {
      fs.copyFileSync(rutaOrigen, rutaDestino);
      fs.chmodSync(rutaDestino, fs.statSync(rutaOrigen).mode);
    }
  }
}

function listarSkills(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((nombre) => fs.existsSync(path.join(dir, nombre, "SKILL.md")));
}

function traducir(raiz, dirOrigenRel, dirDestinoRel) {
  const dirOrigen = path.join(raiz, dirOrigenRel);
  const dirDestino = path.join(raiz, dirDestinoRel);

  const nombres = listarSkills(dirOrigen);
  if (nombres.length === 0) return [];

  fs.mkdirSync(dirDestino, { recursive: true });

  for (const nombre of nombres) {
    copiarCarpeta(path.join(dirOrigen, nombre), path.join(dirDestino, nombre));
  }

  return nombres;
}

export function claudeAcopilot(raiz) {
  return traducir(raiz, DIR_CLAUDE, DIR_COPILOT);
}

export function copilotAclaude(raiz) {
  return traducir(raiz, DIR_COPILOT, DIR_CLAUDE);
}

export function claudeAcodex(raiz) {
  return traducir(raiz, DIR_CLAUDE, DIR_CODEX);
}

export function copilotAcodex(raiz) {
  return traducir(raiz, DIR_COPILOT, DIR_CODEX);
}

export function codexAclaude(raiz) {
  return traducir(raiz, DIR_CODEX, DIR_CLAUDE);
}

export function codexAcopilot(raiz) {
  return traducir(raiz, DIR_CODEX, DIR_COPILOT);
}

export function claudeAcomposer(raiz) {
  return traducir(raiz, DIR_CLAUDE, DIR_COMPOSER);
}

export function copilotAcomposer(raiz) {
  return traducir(raiz, DIR_COPILOT, DIR_COMPOSER);
}

export function codexAcomposer(raiz) {
  return traducir(raiz, DIR_CODEX, DIR_COMPOSER);
}

export function composerAclaude(raiz) {
  return traducir(raiz, DIR_COMPOSER, DIR_CLAUDE);
}

export function composerAcopilot(raiz) {
  return traducir(raiz, DIR_COMPOSER, DIR_COPILOT);
}

export function composerAcodex(raiz) {
  return traducir(raiz, DIR_COMPOSER, DIR_CODEX);
}