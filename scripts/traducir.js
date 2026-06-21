#!/usr/bin/env node
// traducir.js — traduce TODA la infraestructura de IA entre Claude Code,
// GitHub Copilot y Codex.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as manual from "./lib/manual.js";
import * as skills from "./lib/skills.js";
import * as agentes from "./lib/agentes.js";
import * as hooks from "./lib/hooks.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const C = {
  verde: (s) => `\x1b[0;32m${s}\x1b[0m`,
  amarillo: (s) => `\x1b[0;33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[0;36m${s}\x1b[0m`,
};

const RUTAS = {
  claude: [
    "CLAUDE.md",
    path.join(".claude", "skills"),
    path.join(".claude", "agents"),
    path.join(".claude", "hooks"),
    path.join(".claude", "settings.json"),
  ],
  copilot: [
    path.join(".github", "copilot-instructions.md"),
    path.join(".github", "skills"),
    path.join(".github", "agents"),
    path.join(".github", "hooks"),
  ],
  codex: [
    "AGENTS.md",
    path.join(".codex", "config.toml"),
    path.join(".codex", "hooks.json"),
    path.join(".codex", "hooks"),
    path.join(".codex", "agents"),
    path.join(".codex", "skills"),
  ],
  composer: [
    path.join(".cursor", "rules"),
    path.join(".cursor", "skills"),
    path.join(".cursor", "agents"),
    path.join(".cursor", "hooks"),
    path.join(".cursor", "hooks.json"),
  ],
};

const CARPETA_CONTENEDORA = {
  claude: ".claude",
  copilot: ".github",
  codex: ".codex",
  composer: ".cursor",
};

function existeAlgoDe(modelo) {
  return RUTAS[modelo].some((ruta) => fs.existsSync(path.join(RAIZ, ruta)));
}

function borrar(modelo) {
  for (const ruta of RUTAS[modelo]) {
    fs.rmSync(path.join(RAIZ, ruta), { recursive: true, force: true });
  }

  const carpeta = path.join(RAIZ, CARPETA_CONTENEDORA[modelo]);
  if (fs.existsSync(carpeta) && fs.readdirSync(carpeta).length === 0) {
    fs.rmdirSync(carpeta);
  }

  // En Codex las skills repo-scoped van en .codex/skills.
  if (modelo === "codex") {
    const agents = path.join(RAIZ, ".codex");
    if (fs.existsSync(agents) && fs.readdirSync(agents).length === 0) {
      fs.rmdirSync(agents);
    }
  }
}

function modelosOrigenExcepto(destino) {
  return ["claude", "copilot", "codex", "composer"].filter(
    (m) => m !== destino && existeAlgoDe(m)
  );
}

function elegirOrigen(destino) {
  const candidatos = modelosOrigenExcepto(destino);

  if (candidatos.length === 0) {
    console.log(C.amarillo("!") + ` No hay infraestructura de la que traducir hacia ${destino}.`);
    return null;
  }

  if (candidatos.length > 1) {
    console.log(
      C.amarillo("!") +
        ` Hay varias infraestructuras activas (${candidatos.join(", ")}). Usaré '${candidatos[0]}'.`
    );
  }

  return candidatos[0];
}

function traducirManual(origen, destino) {
  return manual[`${origen}A${destino}`]?.(RAIZ);
}

function traducirSkills(origen, destino) {
  return skills[`${origen}A${destino}`]?.(RAIZ) || [];
}

function traducirAgentes(origen, destino) {
  return agentes[`${origen}A${destino}`]?.(RAIZ) || [];
}

function traducirHooks(origen, destino) {
  return hooks[`${origen}A${destino}`]?.(RAIZ) || { traducidos: [], avisos: [] };
}

function traducirA(destino) {
  const origen = elegirOrigen(destino);
  if (!origen) return false;

  console.log(C.cyan("→") + ` Borrando infraestructura anterior de ${destino}...`);
  borrar(destino);

  console.log(C.cyan("→") + ` Traduciendo desde ${origen} hacia ${destino}...`);

  const m = traducirManual(origen, destino);
  if (m) console.log(C.verde("✓") + ` Manual traducido: ${m}`);

  const sk = traducirSkills(origen, destino);
  if (sk.length) console.log(C.verde("✓") + ` ${sk.length} skill(s) traducida(s): ${sk.join(", ")}`);

  const ag = traducirAgentes(origen, destino);
  if (ag.length) console.log(C.verde("✓") + ` ${ag.length} subagente(s) traducido(s): ${ag.join(", ")}`);

  const hk = traducirHooks(origen, destino);
  if (hk.traducidos.length) console.log(C.verde("✓") + ` ${hk.traducidos.length} hook(s) traducido(s)`);
  hk.avisos.forEach((a) => console.log(C.amarillo("!") + " " + a));

  console.log(C.cyan("→") + ` Quitando la infraestructura de ${origen}, ya traducida...`);
  borrar(origen);

  return true;
}

function mostrarEstado() {
  const hayClaude = existeAlgoDe("claude");
  const hayCopilot = existeAlgoDe("copilot");
  const hayCodex = existeAlgoDe("codex");
  const hayComposer = existeAlgoDe("composer");


  if (hayClaude) console.log(C.verde("✓") + " Modelo activo: Claude Code (.claude/ / CLAUDE.md)");
  if (hayCopilot) console.log(C.verde("✓") + " Modelo activo: Copilot (.github/)");
  if (hayCodex) console.log(C.verde("✓") + " Modelo activo: Codex (AGENTS.md / .codex/ / .codex/skills)");
  if (hayComposer) console.log(C.verde("✓") + " Modelo activo: Cursor Composer 2 (.cursor/)");

  if (!hayClaude && !hayCopilot && !hayCodex) {
    console.log(C.amarillo("!") + " No hay infraestructura de ningún modelo todavía.");
  }

  const activos = [hayClaude, hayCopilot, hayCodex, hayComposer].filter(Boolean).length;
  if (activos > 1) {
    console.log(C.amarillo("!") + " Hay infraestructura de varios modelos a la vez.");
  }
}

const modelo = process.argv[2];

if (modelo === "claude") {
  const ok = traducirA("claude");
  console.log("");
  if (ok) console.log(C.verde("✓") + " Listo. Ahora solo existe la infraestructura de Claude Code.");
} else if (modelo === "copilot") {
  const ok = traducirA("copilot");
  console.log("");
  if (ok) console.log(C.verde("✓") + " Listo. Ahora solo existe la infraestructura de Copilot.");
} else if (modelo === "codex") {
  const ok = traducirA("codex");
  console.log("");
  if (ok) console.log(C.verde("✓") + " Listo. Ahora solo existe la infraestructura de Codex.");
} else if (modelo === "composer") {
  const ok = traducirA("composer");
  console.log("");
  if (ok) console.log(C.verde("✓") + " Listo. Ahora solo existe la infraestructura de Cursor Composer 2.");  
} else if (modelo === "estado") {
  mostrarEstado();
} else {
  console.error("Uso: node traducir.js <claude|copilot|codex|composer|estado>");
  process.exit(1);
}