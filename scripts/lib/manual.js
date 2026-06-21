import fs from "node:fs";
import path from "node:path";
import { avisoGenerado } from "./frontmatter.js";

const RUTA_CLAUDE = "CLAUDE.md";
const RUTA_COPILOT = path.join(".github", "copilot-instructions.md");
const RUTA_CODEX = "AGENTS.md";
const RUTA_COMPOSER = path.join(".cursor", "rules", "project.mdc");

function limpiarAviso(contenido) {
  return contenido.replace(/^<!--[\s\S]*?-->\n<!--[\s\S]*?-->\n\n?/, "");
}

function limpiarMdc(contenido) {
  return contenido.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function envolverMdc(contenido) {
  return [
    "---",
    "description: Reglas globales del proyecto",
    "alwaysApply: true",
    "---",
    "",
    contenido.trimEnd(),
    "",
  ].join("\n");
}

function copiarManual(raiz, origenRel, destinoRel, comando, opciones = {}) {
  const origen = path.join(raiz, origenRel);
  if (!fs.existsSync(origen)) return null;

  let contenido = fs.readFileSync(origen, "utf8");
  contenido = limpiarAviso(contenido);

  if (opciones.origenMdc) {
    contenido = limpiarMdc(contenido);
  }

  if (opciones.destinoMdc) {
    contenido = envolverMdc(contenido);
  } else {
    contenido = avisoGenerado(origenRel, comando) + "\n" + contenido;
  }

  const destino = path.join(raiz, destinoRel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, contenido);

  return `${origenRel} → ${destinoRel}`;
}

export function claudeAcopilot(raiz) {
  return copiarManual(raiz, RUTA_CLAUDE, RUTA_COPILOT, "./adaptar.sh copilot");
}

export function copilotAclaude(raiz) {
  return copiarManual(raiz, RUTA_COPILOT, RUTA_CLAUDE, "./adaptar.sh claude");
}

export function claudeAcodex(raiz) {
  return copiarManual(raiz, RUTA_CLAUDE, RUTA_CODEX, "./adaptar.sh codex");
}

export function copilotAcodex(raiz) {
  return copiarManual(raiz, RUTA_COPILOT, RUTA_CODEX, "./adaptar.sh codex");
}

export function codexAclaude(raiz) {
  return copiarManual(raiz, RUTA_CODEX, RUTA_CLAUDE, "./adaptar.sh claude");
}

export function codexAcopilot(raiz) {
  return copiarManual(raiz, RUTA_CODEX, RUTA_COPILOT, "./adaptar.sh copilot");
}

// Composer 2 / Cursor
export function claudeAcomposer(raiz) {
  return copiarManual(raiz, RUTA_CLAUDE, RUTA_COMPOSER, "./adaptar.sh composer", {
    destinoMdc: true,
  });
}

export function copilotAcomposer(raiz) {
  return copiarManual(raiz, RUTA_COPILOT, RUTA_COMPOSER, "./adaptar.sh composer", {
    destinoMdc: true,
  });
}

export function codexAcomposer(raiz) {
  return copiarManual(raiz, RUTA_CODEX, RUTA_COMPOSER, "./adaptar.sh composer", {
    destinoMdc: true,
  });
}

export function composerAclaude(raiz) {
  return copiarManual(raiz, RUTA_COMPOSER, RUTA_CLAUDE, "./adaptar.sh claude", {
    origenMdc: true,
  });
}

export function composerAcopilot(raiz) {
  return copiarManual(raiz, RUTA_COMPOSER, RUTA_COPILOT, "./adaptar.sh copilot", {
    origenMdc: true,
  });
}

export function composerAcodex(raiz) {
  return copiarManual(raiz, RUTA_COMPOSER, RUTA_CODEX, "./adaptar.sh codex", {
    origenMdc: true,
  });
}