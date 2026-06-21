// hooks.js
// Conversión estable de hooks entre Claude Code, GitHub Copilot y Codex.
//
// Objetivo práctico:
// - Claude y Codex usan una estructura compatible tipo:
//   hooks: { Evento: [{ matcher, hooks: [{ type: "command", command }] }] }
// - Copilot usa .github/hooks/config.json con:
//   hooks: { evento: [{ bash: ".github/hooks/script.sh" }] }
//
// Para no perder lógica:
// - Al pasar Claude/Codex -> Copilot, se copia el script real y se crea wrapper .copilot.sh.
// - Al pasar Copilot -> Claude/Codex, si existe script real, se usa ese; si no, se usa el wrapper.
// - Se intenta extraer el nombre del script aunque el command venga con bash, comillas o git rev-parse.

import fs from "node:fs";
import path from "node:path";

const RUTA_SETTINGS_CLAUDE = path.join(".claude", "settings.json");
const DIR_HOOKS_CLAUDE = path.join(".claude", "hooks");

const DIR_HOOKS_COPILOT = path.join(".github", "hooks");
const RUTA_CONFIG_COPILOT = path.join(".github", "hooks", "config.json");

const DIR_HOOKS_CODEX = path.join(".codex", "hooks");
const RUTA_HOOKS_CODEX = path.join(".codex", "hooks.json");

const DIR_HOOKS_COMPOSER = path.join(".cursor", "hooks");
const RUTA_HOOKS_COMPOSER = path.join(".cursor", "hooks.json");

// Claude <-> Copilot
const EVENTOS_CLAUDE_A_COPILOT = {
  PreToolUse: "preToolUse",
  PostToolUse: "postToolUse",
  UserPromptSubmit: "userPromptSubmitted",
  Stop: "sessionEnd",
};

const EVENTOS_COPILOT_A_CLAUDE = Object.fromEntries(
  Object.entries(EVENTOS_CLAUDE_A_COPILOT).map(([k, v]) => [v, k])
);

// Claude <-> Codex
const EVENTOS_CLAUDE_A_CODEX = {
  PreToolUse: "PreToolUse",
  PostToolUse: "PostToolUse",
  UserPromptSubmit: "UserPromptSubmit",
  Stop: "Stop",
};

const EVENTOS_CODEX_A_CLAUDE = Object.fromEntries(
  Object.entries(EVENTOS_CLAUDE_A_CODEX).map(([k, v]) => [v, k])
);

// Copilot <-> Codex
const EVENTOS_COPILOT_A_CODEX = {
  preToolUse: "PreToolUse",
  postToolUse: "PostToolUse",
  userPromptSubmitted: "UserPromptSubmit",
  sessionEnd: "Stop",
};

const EVENTOS_CLAUDE_A_COMPOSER = {
  PreToolUse: "preToolUse",
  PostToolUse: "postToolUse",
  UserPromptSubmit: "beforeSubmitPrompt",
  Stop: "stop",
};

const EVENTOS_COMPOSER_A_CLAUDE = Object.fromEntries(
  Object.entries(EVENTOS_CLAUDE_A_COMPOSER).map(([k, v]) => [v, k])
);

const EVENTOS_COPILOT_A_COMPOSER = {
  preToolUse: "preToolUse",
  postToolUse: "postToolUse",
  userPromptSubmitted: "beforeSubmitPrompt",
  sessionEnd: "stop",
};

const EVENTOS_COMPOSER_A_COPILOT = Object.fromEntries(
  Object.entries(EVENTOS_COPILOT_A_COMPOSER).map(([k, v]) => [v, k])
);

const EVENTOS_CODEX_A_COMPOSER = {
  PreToolUse: "preToolUse",
  PostToolUse: "postToolUse",
  UserPromptSubmit: "beforeSubmitPrompt",
  Stop: "stop",
};

const EVENTOS_COMPOSER_A_CODEX = Object.fromEntries(
  Object.entries(EVENTOS_CODEX_A_COMPOSER).map(([k, v]) => [v, k])
);

const EVENTOS_CODEX_A_COPILOT = Object.fromEntries(
  Object.entries(EVENTOS_COPILOT_A_CODEX).map(([k, v]) => [v, k])
);

const EVENTOS_COPILOT_SOLO_OBSERVACION = new Set([
  "sessionStart",
  "userPromptSubmitted",
  "postToolUse",
  "sessionEnd",
  "errorOccurred",
]);

function leerJson(ruta) {
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

function escribirJson(ruta, data) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(data, null, 2) + "\n");
}

function copiarScript(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
  fs.chmodSync(destino, fs.statSync(origen).mode | 0o755);
}

function existe(ruta) {
  return fs.existsSync(ruta);
}

function sinComillas(s) {
  return String(s || "").replace(/^["']|["']$/g, "");
}

function extraerNombreScript(command) {
  const c = String(command || "");

  const patrones = [
    /\.claude\/hooks\/([^"'\s;]+)/,
    /\.github\/hooks\/([^"'\s;]+)/,
    /\.codex\/hooks\/([^"'\s;]+)/,
    /\.cursor\/hooks\/([^"'\s;]+)/,
    /hooks\/([^"'\s;]+\.sh)/,
    /scripts\/hooks\/([^"'\s;]+)/,
    /scripts\/([^"'\s;]+)/,
  ];

  for (const patron of patrones) {
    const match = c.match(patron);
    if (match) return path.basename(sinComillas(match[1]));
  }

  const partes = c
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .map(sinComillas)
    .filter(Boolean);

  const candidato = [...partes].reverse().find((p) => p.endsWith(".sh"));
  return candidato ? path.basename(candidato) : path.basename(sinComillas(c));
}

function nombreScriptRealDesdeCopilot(nombreArchivo) {
  return nombreArchivo.endsWith(".copilot.sh")
    ? nombreArchivo.replace(/\.copilot\.sh$/, ".sh")
    : nombreArchivo;
}

function resolverScript(raiz, command, dirModeloRel) {
  const nombreScript = extraerNombreScript(command);

  const candidatos = [
    path.join(raiz, dirModeloRel, nombreScript),
    path.join(raiz, command),
    path.join(raiz, sinComillas(command)),
    path.join(raiz, "scripts", "hooks", nombreScript),
    path.join(raiz, "scripts", nombreScript),
  ];

  for (const candidato of candidatos) {
    if (existe(candidato)) {
      return {
        nombreScript,
        ruta: candidato,
      };
    }
  }

  return {
    nombreScript,
    ruta: null,
  };
}

function comandoCodex(nombreScript) {
  return `bash "$(git rev-parse --show-toplevel)/.codex/hooks/${nombreScript}"`;
}

function comandoClaude(nombreScript) {
  return `.claude/hooks/${nombreScript}`;
}

function comandoCopilot(nombreScript) {
  return `.github/hooks/${nombreScript}`;
}

function comandoComposer(nombreScript) {
  return `hooks/${nombreScript}`;
}

function normalizarMatcher(matcher, fallback = "Read|Write|Edit") {
  if (!matcher) return fallback;
  return matcher;
}

function crearWrapperCopilot(nombreScriptOriginal, puedeBloquear) {
  const lineas = [
    "#!/bin/bash",
    "# Wrapper generado automáticamente.",
    "# Ejecuta el hook real y adapta la salida al formato de GitHub Copilot.",
    "",
    `DIR="$(cd "$(dirname "${"${BASH_SOURCE[0]}"}")" && pwd)"`,
    `"$DIR/${nombreScriptOriginal}"`,
    "CODIGO=$?",
    "",
  ];

  if (puedeBloquear) {
    lineas.push(
      'if [ "$CODIGO" -eq 2 ]; then',
      '  echo \'{"permissionDecision":"deny","permissionDecisionReason":"Bloqueado por regla del proyecto"}\'',
      "else",
      '  echo \'{"permissionDecision":"allow"}\'',
      "fi"
    );
  } else {
    lineas.push(
      "# Este evento no bloquea en Copilot.",
      "exit 0"
    );
  }

  return lineas.join("\n") + "\n";
}

function copiarAHooksDestino(raiz, origenAbs, dirDestinoRel, nombreScript) {
  const destino = path.join(raiz, dirDestinoRel, nombreScript);
  copiarScript(origenAbs, destino);
  return destino;
}

// ─────────────────────────────────────────────
// Claude -> Copilot
// ─────────────────────────────────────────────

export function claudeAcopilot(raiz) {
  const rutaSettings = path.join(raiz, RUTA_SETTINGS_CLAUDE);
  if (!existe(rutaSettings)) return { traducidos: [], avisos: [] };

  const settings = leerJson(rutaSettings);
  const configCopilot = { version: 1, hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoClaude, reglas] of Object.entries(settings.hooks || {})) {
    const eventoCopilot = EVENTOS_CLAUDE_A_COPILOT[eventoClaude];

    if (!eventoCopilot) {
      avisos.push(`Evento '${eventoClaude}' no tiene equivalente en Copilot, se omite.`);
      continue;
    }

    configCopilot.hooks[eventoCopilot] = configCopilot.hooks[eventoCopilot] || [];

    for (const regla of reglas || []) {
      for (const hook of regla.hooks || []) {
        if (hook.type !== "command") continue;

        const { nombreScript, ruta } = resolverScript(raiz, hook.command, DIR_HOOKS_CLAUDE);

        if (!ruta) {
          avisos.push(`No se encontró el script '${nombreScript}' de Claude.`);
          continue;
        }

        copiarAHooksDestino(raiz, ruta, DIR_HOOKS_COPILOT, nombreScript);

        const nombreWrapper = nombreScript.replace(/\.sh$/, ".copilot.sh");
        const puedeBloquear = eventoCopilot === "preToolUse";
        const wrapper = crearWrapperCopilot(nombreScript, puedeBloquear);

        const rutaWrapper = path.join(raiz, DIR_HOOKS_COPILOT, nombreWrapper);
        fs.writeFileSync(rutaWrapper, wrapper);
        fs.chmodSync(rutaWrapper, 0o755);

        configCopilot.hooks[eventoCopilot].push({
          bash: comandoCopilot(nombreWrapper),
        });

        traducidos.push({
          original: nombreScript,
          evento: `${eventoClaude} → ${eventoCopilot}`,
        });
      }
    }
  }

  escribirJson(path.join(raiz, RUTA_CONFIG_COPILOT), configCopilot);
  return { traducidos, avisos };
}

// ─────────────────────────────────────────────
// Copilot -> Claude
// ─────────────────────────────────────────────

export function copilotAclaude(raiz) {
  const rutaConfig = path.join(raiz, RUTA_CONFIG_COPILOT);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configCopilot = leerJson(rutaConfig);
  const settingsClaude = { hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoCopilot, lista] of Object.entries(configCopilot.hooks || {})) {
    const eventoClaude = EVENTOS_COPILOT_A_CLAUDE[eventoCopilot];

    if (!eventoClaude) {
      avisos.push(`Evento '${eventoCopilot}' no tiene equivalente en Claude Code, se omite.`);
      continue;
    }

    if (EVENTOS_COPILOT_SOLO_OBSERVACION.has(eventoCopilot) && eventoCopilot !== "postToolUse") {
      avisos.push(`'${eventoCopilot}' es observacional en Copilot; revisa si debe bloquear en Claude.`);
    }

    settingsClaude.hooks[eventoClaude] = settingsClaude.hooks[eventoClaude] || [];

    for (const entrada of lista || []) {
      if (!entrada.bash) continue;

      const nombreArchivo = extraerNombreScript(entrada.bash);
      const nombreReal = nombreScriptRealDesdeCopilot(nombreArchivo);

      const origenReal = path.join(raiz, DIR_HOOKS_COPILOT, nombreReal);
      const origenWrapper = path.join(raiz, DIR_HOOKS_COPILOT, nombreArchivo);
      const origen = existe(origenReal) ? origenReal : origenWrapper;

      if (!existe(origen)) {
        avisos.push(`No se encontró el script '${nombreArchivo}' en Copilot.`);
        continue;
      }

      copiarAHooksDestino(raiz, origen, DIR_HOOKS_CLAUDE, nombreReal);

      settingsClaude.hooks[eventoClaude].push({
        matcher: "Read|Write|Edit",
        hooks: [
          {
            type: "command",
            command: comandoClaude(nombreReal),
          },
        ],
      });

      traducidos.push({
        original: nombreReal,
        evento: `${eventoCopilot} → ${eventoClaude}`,
      });
    }
  }

  escribirJson(path.join(raiz, RUTA_SETTINGS_CLAUDE), settingsClaude);
  return { traducidos, avisos };
}

// ─────────────────────────────────────────────
// Claude -> Codex
// ─────────────────────────────────────────────

export function claudeAcodex(raiz) {
  const rutaSettings = path.join(raiz, RUTA_SETTINGS_CLAUDE);
  if (!existe(rutaSettings)) return { traducidos: [], avisos: [] };

  const settings = leerJson(rutaSettings);
  const configCodex = { hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoClaude, reglas] of Object.entries(settings.hooks || {})) {
    const eventoCodex = EVENTOS_CLAUDE_A_CODEX[eventoClaude];

    if (!eventoCodex) {
      avisos.push(`Evento '${eventoClaude}' no tiene equivalente en Codex, se omite.`);
      continue;
    }

    configCodex.hooks[eventoCodex] = configCodex.hooks[eventoCodex] || [];

    for (const regla of reglas || []) {
      const grupo = {
        matcher: normalizarMatcher(regla.matcher),
        hooks: [],
      };

      for (const hook of regla.hooks || []) {
        if (hook.type !== "command") continue;

        const { nombreScript, ruta } = resolverScript(raiz, hook.command, DIR_HOOKS_CLAUDE);

        if (!ruta) {
          avisos.push(`No se encontró el script '${nombreScript}' de Claude.`);
          continue;
        }

        copiarAHooksDestino(raiz, ruta, DIR_HOOKS_CODEX, nombreScript);

        grupo.hooks.push({
          type: "command",
          command: comandoCodex(nombreScript),
          timeout: 600,
        });

        traducidos.push({
          original: nombreScript,
          evento: `${eventoClaude} → ${eventoCodex}`,
        });
      }

      if (grupo.hooks.length) {
        configCodex.hooks[eventoCodex].push(grupo);
      }
    }
  }

  escribirJson(path.join(raiz, RUTA_HOOKS_CODEX), configCodex);
  return { traducidos, avisos };
}

// ─────────────────────────────────────────────
// Codex -> Claude
// ─────────────────────────────────────────────

export function codexAclaude(raiz) {
  const rutaConfig = path.join(raiz, RUTA_HOOKS_CODEX);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configCodex = leerJson(rutaConfig);
  const settingsClaude = { hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoCodex, reglas] of Object.entries(configCodex.hooks || {})) {
    const eventoClaude = EVENTOS_CODEX_A_CLAUDE[eventoCodex];

    if (!eventoClaude) {
      avisos.push(`Evento '${eventoCodex}' no tiene equivalente en Claude Code, se omite.`);
      continue;
    }

    settingsClaude.hooks[eventoClaude] = settingsClaude.hooks[eventoClaude] || [];

    for (const regla of reglas || []) {
      const grupo = {
        matcher: normalizarMatcher(regla.matcher),
        hooks: [],
      };

      for (const hook of regla.hooks || []) {
        if (hook.type !== "command") continue;

        const { nombreScript, ruta } = resolverScript(raiz, hook.command, DIR_HOOKS_CODEX);

        if (!ruta) {
          avisos.push(`No se encontró el script '${nombreScript}' de Codex.`);
          continue;
        }

        copiarAHooksDestino(raiz, ruta, DIR_HOOKS_CLAUDE, nombreScript);

        grupo.hooks.push({
          type: "command",
          command: comandoClaude(nombreScript),
        });

        traducidos.push({
          original: nombreScript,
          evento: `${eventoCodex} → ${eventoClaude}`,
        });
      }

      if (grupo.hooks.length) {
        settingsClaude.hooks[eventoClaude].push(grupo);
      }
    }
  }

  escribirJson(path.join(raiz, RUTA_SETTINGS_CLAUDE), settingsClaude);
  return { traducidos, avisos };
}

// ─────────────────────────────────────────────
// Copilot -> Codex
// ─────────────────────────────────────────────

export function copilotAcodex(raiz) {
  const rutaConfig = path.join(raiz, RUTA_CONFIG_COPILOT);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configCopilot = leerJson(rutaConfig);
  const configCodex = { hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoCopilot, lista] of Object.entries(configCopilot.hooks || {})) {
    const eventoCodex = EVENTOS_COPILOT_A_CODEX[eventoCopilot];

    if (!eventoCodex) {
      avisos.push(`Evento '${eventoCopilot}' no tiene equivalente en Codex, se omite.`);
      continue;
    }

    configCodex.hooks[eventoCodex] = configCodex.hooks[eventoCodex] || [];

    for (const entrada of lista || []) {
      if (!entrada.bash) continue;

      const nombreArchivo = extraerNombreScript(entrada.bash);
      const nombreReal = nombreScriptRealDesdeCopilot(nombreArchivo);

      const origenReal = path.join(raiz, DIR_HOOKS_COPILOT, nombreReal);
      const origenWrapper = path.join(raiz, DIR_HOOKS_COPILOT, nombreArchivo);
      const origen = existe(origenReal) ? origenReal : origenWrapper;

      if (!existe(origen)) {
        avisos.push(`No se encontró el script '${nombreArchivo}' en Copilot.`);
        continue;
      }

      copiarAHooksDestino(raiz, origen, DIR_HOOKS_CODEX, nombreReal);

      configCodex.hooks[eventoCodex].push({
        matcher: "Read|Write|Edit",
        hooks: [
          {
            type: "command",
            command: comandoCodex(nombreReal),
            timeout: 600,
          },
        ],
      });

      traducidos.push({
        original: nombreReal,
        evento: `${eventoCopilot} → ${eventoCodex}`,
      });
    }
  }

  escribirJson(path.join(raiz, RUTA_HOOKS_CODEX), configCodex);
  return { traducidos, avisos };
}

// ─────────────────────────────────────────────
// Codex -> Copilot
// ─────────────────────────────────────────────

export function codexAcopilot(raiz) {
  const rutaConfig = path.join(raiz, RUTA_HOOKS_CODEX);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configCodex = leerJson(rutaConfig);
  const configCopilot = { version: 1, hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoCodex, reglas] of Object.entries(configCodex.hooks || {})) {
    const eventoCopilot = EVENTOS_CODEX_A_COPILOT[eventoCodex];

    if (!eventoCopilot) {
      avisos.push(`Evento '${eventoCodex}' no tiene equivalente en Copilot, se omite.`);
      continue;
    }

    configCopilot.hooks[eventoCopilot] = configCopilot.hooks[eventoCopilot] || [];

    for (const regla of reglas || []) {
      for (const hook of regla.hooks || []) {
        if (hook.type !== "command") continue;

        const { nombreScript, ruta } = resolverScript(raiz, hook.command, DIR_HOOKS_CODEX);

        if (!ruta) {
          avisos.push(`No se encontró el script '${nombreScript}' de Codex.`);
          continue;
        }

        copiarAHooksDestino(raiz, ruta, DIR_HOOKS_COPILOT, nombreScript);

        const nombreWrapper = nombreScript.replace(/\.sh$/, ".copilot.sh");
        const puedeBloquear = eventoCopilot === "preToolUse";
        const wrapper = crearWrapperCopilot(nombreScript, puedeBloquear);

        const rutaWrapper = path.join(raiz, DIR_HOOKS_COPILOT, nombreWrapper);
        fs.writeFileSync(rutaWrapper, wrapper);
        fs.chmodSync(rutaWrapper, 0o755);

        configCopilot.hooks[eventoCopilot].push({
          bash: comandoCopilot(nombreWrapper),
        });

        traducidos.push({
          original: nombreScript,
          evento: `${eventoCodex} → ${eventoCopilot}`,
        });
      }
    }
  }

  escribirJson(path.join(raiz, RUTA_CONFIG_COPILOT), configCopilot);
  return { traducidos, avisos };
}
export function claudeAcomposer(raiz) {
  const rutaSettings = path.join(raiz, RUTA_SETTINGS_CLAUDE);
  if (!existe(rutaSettings)) return { traducidos: [], avisos: [] };

  const settings = leerJson(rutaSettings);
  const configComposer = { version: 1, hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoClaude, reglas] of Object.entries(settings.hooks || {})) {
    const eventoComposer = EVENTOS_CLAUDE_A_COMPOSER[eventoClaude];

    if (!eventoComposer) {
      avisos.push(`Evento '${eventoClaude}' no tiene equivalente en Composer/Cursor, se omite.`);
      continue;
    }

    configComposer.hooks[eventoComposer] = configComposer.hooks[eventoComposer] || [];

    for (const regla of reglas || []) {
      for (const hook of regla.hooks || []) {
        if (hook.type !== "command") continue;

        const { nombreScript, ruta } = resolverScript(raiz, hook.command, DIR_HOOKS_CLAUDE);

        if (!ruta) {
          avisos.push(`No se encontró el script '${nombreScript}' de Claude.`);
          continue;
        }

        copiarAHooksDestino(raiz, ruta, DIR_HOOKS_COMPOSER, nombreScript);

        const entrada = {
          command: comandoComposer(nombreScript),
        };

        if (regla.matcher) {
          entrada.matcher = regla.matcher;
        }

        configComposer.hooks[eventoComposer].push(entrada);

        traducidos.push({
          original: nombreScript,
          evento: `${eventoClaude} → ${eventoComposer}`,
        });
      }
    }
  }

  escribirJson(path.join(raiz, RUTA_HOOKS_COMPOSER), configComposer);
  return { traducidos, avisos };
}

export function composerAclaude(raiz) {
  const rutaConfig = path.join(raiz, RUTA_HOOKS_COMPOSER);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configComposer = leerJson(rutaConfig);
  const settingsClaude = { hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoComposer, lista] of Object.entries(configComposer.hooks || {})) {
    const eventoClaude = EVENTOS_COMPOSER_A_CLAUDE[eventoComposer];

    if (!eventoClaude) {
      avisos.push(`Evento '${eventoComposer}' no tiene equivalente en Claude Code, se omite.`);
      continue;
    }

    settingsClaude.hooks[eventoClaude] = settingsClaude.hooks[eventoClaude] || [];

    for (const entrada of lista || []) {
      if (!entrada.command) continue;

      const { nombreScript, ruta } = resolverScript(
        raiz,
        entrada.command,
        DIR_HOOKS_COMPOSER
      );

      if (!ruta) {
        avisos.push(`No se encontró el script '${nombreScript}' de Composer/Cursor.`);
        continue;
      }

      copiarAHooksDestino(raiz, ruta, DIR_HOOKS_CLAUDE, nombreScript);

      settingsClaude.hooks[eventoClaude].push({
        matcher: entrada.matcher || "Read|Write|Edit",
        hooks: [
          {
            type: "command",
            command: comandoClaude(nombreScript),
          },
        ],
      });

      traducidos.push({
        original: nombreScript,
        evento: `${eventoComposer} → ${eventoClaude}`,
      });
    }
  }

  escribirJson(path.join(raiz, RUTA_SETTINGS_CLAUDE), settingsClaude);
  return { traducidos, avisos };
}

export function copilotAcomposer(raiz) {
  const rutaConfig = path.join(raiz, RUTA_CONFIG_COPILOT);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configCopilot = leerJson(rutaConfig);
  const configComposer = { version: 1, hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoCopilot, lista] of Object.entries(configCopilot.hooks || {})) {
    const eventoComposer = EVENTOS_COPILOT_A_COMPOSER[eventoCopilot];

    if (!eventoComposer) {
      avisos.push(`Evento '${eventoCopilot}' no tiene equivalente en Composer/Cursor, se omite.`);
      continue;
    }

    configComposer.hooks[eventoComposer] = configComposer.hooks[eventoComposer] || [];

    for (const entrada of lista || []) {
      if (!entrada.bash) continue;

      const nombreArchivo = extraerNombreScript(entrada.bash);
      const nombreReal = nombreScriptRealDesdeCopilot(nombreArchivo);

      const origenReal = path.join(raiz, DIR_HOOKS_COPILOT, nombreReal);
      const origenWrapper = path.join(raiz, DIR_HOOKS_COPILOT, nombreArchivo);
      const origen = existe(origenReal) ? origenReal : origenWrapper;

      if (!existe(origen)) {
        avisos.push(`No se encontró el script '${nombreArchivo}' en Copilot.`);
        continue;
      }

      copiarAHooksDestino(raiz, origen, DIR_HOOKS_COMPOSER, nombreReal);

      configComposer.hooks[eventoComposer].push({
        command: comandoComposer(nombreReal),
      });

      traducidos.push({
        original: nombreReal,
        evento: `${eventoCopilot} → ${eventoComposer}`,
      });
    }
  }

  escribirJson(path.join(raiz, RUTA_HOOKS_COMPOSER), configComposer);
  return { traducidos, avisos };
}

export function composerAcopilot(raiz) {
  const rutaConfig = path.join(raiz, RUTA_HOOKS_COMPOSER);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configComposer = leerJson(rutaConfig);
  const configCopilot = { version: 1, hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoComposer, lista] of Object.entries(configComposer.hooks || {})) {
    const eventoCopilot = EVENTOS_COMPOSER_A_COPILOT[eventoComposer];

    if (!eventoCopilot) {
      avisos.push(`Evento '${eventoComposer}' no tiene equivalente en Copilot, se omite.`);
      continue;
    }

    configCopilot.hooks[eventoCopilot] = configCopilot.hooks[eventoCopilot] || [];

    for (const entrada of lista || []) {
      if (!entrada.command) continue;

      const { nombreScript, ruta } = resolverScript(
        raiz,
        entrada.command,
        DIR_HOOKS_COMPOSER
      );

      if (!ruta) {
        avisos.push(`No se encontró el script '${nombreScript}' de Composer/Cursor.`);
        continue;
      }

      copiarAHooksDestino(raiz, ruta, DIR_HOOKS_COPILOT, nombreScript);

      const nombreWrapper = nombreScript.replace(/\.sh$/, ".copilot.sh");
      const puedeBloquear = eventoCopilot === "preToolUse";
      const wrapper = crearWrapperCopilot(nombreScript, puedeBloquear);

      const rutaWrapper = path.join(raiz, DIR_HOOKS_COPILOT, nombreWrapper);
      fs.writeFileSync(rutaWrapper, wrapper);
      fs.chmodSync(rutaWrapper, 0o755);

      configCopilot.hooks[eventoCopilot].push({
        bash: comandoCopilot(nombreWrapper),
      });

      traducidos.push({
        original: nombreScript,
        evento: `${eventoComposer} → ${eventoCopilot}`,
      });
    }
  }

  escribirJson(path.join(raiz, RUTA_CONFIG_COPILOT), configCopilot);
  return { traducidos, avisos };
}

export function codexAcomposer(raiz) {
  const rutaConfig = path.join(raiz, RUTA_HOOKS_CODEX);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configCodex = leerJson(rutaConfig);
  const configComposer = { version: 1, hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoCodex, reglas] of Object.entries(configCodex.hooks || {})) {
    const eventoComposer = EVENTOS_CODEX_A_COMPOSER[eventoCodex];

    if (!eventoComposer) {
      avisos.push(`Evento '${eventoCodex}' no tiene equivalente en Composer/Cursor, se omite.`);
      continue;
    }

    configComposer.hooks[eventoComposer] = configComposer.hooks[eventoComposer] || [];

    for (const regla of reglas || []) {
      for (const hook of regla.hooks || []) {
        if (hook.type !== "command") continue;

        const { nombreScript, ruta } = resolverScript(raiz, hook.command, DIR_HOOKS_CODEX);

        if (!ruta) {
          avisos.push(`No se encontró el script '${nombreScript}' de Codex.`);
          continue;
        }

        copiarAHooksDestino(raiz, ruta, DIR_HOOKS_COMPOSER, nombreScript);

        const entrada = {
          command: comandoComposer(nombreScript),
        };

        if (regla.matcher) {
          entrada.matcher = regla.matcher;
        }

        configComposer.hooks[eventoComposer].push(entrada);

        traducidos.push({
          original: nombreScript,
          evento: `${eventoCodex} → ${eventoComposer}`,
        });
      }
    }
  }

  escribirJson(path.join(raiz, RUTA_HOOKS_COMPOSER), configComposer);
  return { traducidos, avisos };
}

export function composerAcodex(raiz) {
  const rutaConfig = path.join(raiz, RUTA_HOOKS_COMPOSER);
  if (!existe(rutaConfig)) return { traducidos: [], avisos: [] };

  const configComposer = leerJson(rutaConfig);
  const configCodex = { hooks: {} };
  const traducidos = [];
  const avisos = [];

  for (const [eventoComposer, lista] of Object.entries(configComposer.hooks || {})) {
    const eventoCodex = EVENTOS_COMPOSER_A_CODEX[eventoComposer];

    if (!eventoCodex) {
      avisos.push(`Evento '${eventoComposer}' no tiene equivalente en Codex, se omite.`);
      continue;
    }

    configCodex.hooks[eventoCodex] = configCodex.hooks[eventoCodex] || [];

    for (const entrada of lista || []) {
      if (!entrada.command) continue;

      const { nombreScript, ruta } = resolverScript(
        raiz,
        entrada.command,
        DIR_HOOKS_COMPOSER
      );

      if (!ruta) {
        avisos.push(`No se encontró el script '${nombreScript}' de Composer/Cursor.`);
        continue;
      }

      copiarAHooksDestino(raiz, ruta, DIR_HOOKS_CODEX, nombreScript);

      configCodex.hooks[eventoCodex].push({
        matcher: entrada.matcher || "Read|Write|Edit",
        hooks: [
          {
            type: "command",
            command: comandoCodex(nombreScript),
            timeout: 600,
          },
        ],
      });

      traducidos.push({
        original: nombreScript,
        evento: `${eventoComposer} → ${eventoCodex}`,
      });
    }
  }

  escribirJson(path.join(raiz, RUTA_HOOKS_CODEX), configCodex);
  return { traducidos, avisos };
}