import fs from "node:fs";
import path from "node:path";
import { leerFrontmatter, escribirFrontmatter } from "./frontmatter.js";
import * as modelos from "./modelos.js";

const DIR_CLAUDE = path.join(".claude", "agents");
const DIR_COPILOT = path.join(".github", "agents");
const DIR_CODEX = path.join(".codex", "agents");
const DIR_COMPOSER = path.join(".cursor", "agents");

function escapeTomlString(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function tomlMultiline(s) {
  return `"""${String(s ?? "").replace(/"""/g, '\\"\\"\\"')}"""`;
}

function leerTomlSimple(ruta) {
  const contenido = fs.readFileSync(ruta, "utf8");
  const get = (clave) => {
    const multiline = contenido.match(new RegExp(`^${clave}\\s*=\\s*"""([\\s\\S]*?)"""`, "m"));
    if (multiline) return multiline[1].trim();

    const simple = contenido.match(new RegExp(`^${clave}\\s*=\\s*"([^"]*)"`, "m"));
    if (simple) return simple[1];

    return "";
  };

  return {
    name: get("name"),
    description: get("description"),
    model: get("model"),
    developer_instructions: get("developer_instructions"),
  };
}


function escribirAgenteCodex(frontmatter, cuerpo) {
  const name = frontmatter.name || "agent";
  const description = frontmatter.description || "";
  const model = frontmatter.model || "";

  const lineas = [
    `name = "${escapeTomlString(name)}"`,
    `description = "${escapeTomlString(description)}"`,
  ];

  if (model) {
    lineas.push(`model = "${escapeTomlString(model)}"`);
  }

  lineas.push("");
  lineas.push(`developer_instructions = ${tomlMultiline(cuerpo)}`);
  lineas.push("");

  return lineas.join("\n");
}

function mdACodex(raiz, dirOrigenRel, extensionOrigen, traductorModelo) {
  const dirOrigen = path.join(raiz, dirOrigenRel);
  if (!fs.existsSync(dirOrigen)) return [];

  const dirDestino = path.join(raiz, DIR_CODEX);
  fs.mkdirSync(dirDestino, { recursive: true });

  const traducidos = [];

  for (const archivo of fs.readdirSync(dirOrigen)) {
    if (!archivo.endsWith(extensionOrigen)) continue;

    const { frontmatter, cuerpo } = leerFrontmatter(path.join(dirOrigen, archivo));

    if (frontmatter.model) {
      frontmatter.model = traductorModelo(frontmatter.model);
    }

    const nombreBase = archivo.replace(extensionOrigen, "");
    if (!frontmatter.name) frontmatter.name = nombreBase;

    const destino = path.join(dirDestino, `${nombreBase}.toml`);
    fs.writeFileSync(destino, escribirAgenteCodex(frontmatter, cuerpo));
    traducidos.push(nombreBase);
  }

  return traducidos;
}

function codexAMd(raiz, dirDestinoRel, extensionDestino, traductorModelo) {
  const dirOrigen = path.join(raiz, DIR_CODEX);
  if (!fs.existsSync(dirOrigen)) return [];

  const dirDestino = path.join(raiz, dirDestinoRel);
  fs.mkdirSync(dirDestino, { recursive: true });

  const traducidos = [];

  for (const archivo of fs.readdirSync(dirOrigen)) {
    if (!archivo.endsWith(".toml")) continue;

    const agente = leerTomlSimple(path.join(dirOrigen, archivo));
    const nombreBase = archivo.replace(/\.toml$/, "");

    const frontmatter = {
      name: agente.name || nombreBase,
      description: agente.description || "",
    };

    if (agente.model) {
      frontmatter.model = traductorModelo(agente.model);
    }

    const cuerpo = agente.developer_instructions || "";
    const destino = path.join(dirDestino, `${nombreBase}${extensionDestino}`);

    fs.writeFileSync(destino, escribirFrontmatter(frontmatter, cuerpo));
    traducidos.push(nombreBase);
  }

  return traducidos;
}

function mdAmd(raiz, dirOrigenRel, extensionOrigen, dirDestinoRel, extensionDestino, traductorModelo) {
  const dirOrigen = path.join(raiz, dirOrigenRel);
  if (!fs.existsSync(dirOrigen)) return [];

  const dirDestino = path.join(raiz, dirDestinoRel);
  fs.mkdirSync(dirDestino, { recursive: true });

  const traducidos = [];

  for (const archivo of fs.readdirSync(dirOrigen)) {
    if (!archivo.endsWith(extensionOrigen)) continue;

    const { frontmatter, cuerpo } = leerFrontmatter(path.join(dirOrigen, archivo));

    if (frontmatter.model) {
      frontmatter.model = traductorModelo(frontmatter.model);
    }

    const nombreBase = archivo.replace(extensionOrigen, "");
    if (!frontmatter.name) frontmatter.name = nombreBase;

    const destino = path.join(dirDestino, `${nombreBase}${extensionDestino}`);
    fs.writeFileSync(destino, escribirFrontmatter(frontmatter, cuerpo));
    traducidos.push(nombreBase);
  }

  return traducidos;
}

export function claudeAcopilot(raiz) {
  const dirOrigen = path.join(raiz, DIR_CLAUDE);
  if (!fs.existsSync(dirOrigen)) return [];

  const dirDestino = path.join(raiz, DIR_COPILOT);
  fs.mkdirSync(dirDestino, { recursive: true });

  const traducidos = [];

  for (const archivo of fs.readdirSync(dirOrigen)) {
    if (!archivo.endsWith(".md")) continue;

    const { frontmatter, cuerpo } = leerFrontmatter(path.join(dirOrigen, archivo));

    if (frontmatter.model) {
      frontmatter.model = modelos.claudeAcopilot(frontmatter.model);
    }

    const nombreBase = archivo.replace(/\.md$/, "");
    const destino = path.join(dirDestino, `${nombreBase}.agent.md`);

    fs.writeFileSync(destino, escribirFrontmatter(frontmatter, cuerpo));
    traducidos.push(nombreBase);
  }

  return traducidos;
}

export function copilotAclaude(raiz) {
  const dirOrigen = path.join(raiz, DIR_COPILOT);
  if (!fs.existsSync(dirOrigen)) return [];

  const dirDestino = path.join(raiz, DIR_CLAUDE);
  fs.mkdirSync(dirDestino, { recursive: true });

  const traducidos = [];

  for (const archivo of fs.readdirSync(dirOrigen)) {
    if (!archivo.endsWith(".agent.md")) continue;

    const { frontmatter, cuerpo } = leerFrontmatter(path.join(dirOrigen, archivo));

    if (frontmatter.model) {
      frontmatter.model = modelos.copilotAclaude(frontmatter.model);
    }

    const nombreBase = archivo.replace(/\.agent\.md$/, "");
    const destino = path.join(dirDestino, `${nombreBase}.md`);

    fs.writeFileSync(destino, escribirFrontmatter(frontmatter, cuerpo));
    traducidos.push(nombreBase);
  }

  return traducidos;
}

export function claudeAcodex(raiz) {
  return mdACodex(raiz, DIR_CLAUDE, ".md", modelos.claudeAcodex);
}

export function copilotAcodex(raiz) {
  return mdACodex(raiz, DIR_COPILOT, ".agent.md", modelos.copilotAcodex);
}

export function codexAclaude(raiz) {
  return codexAMd(raiz, DIR_CLAUDE, ".md", modelos.codexAclaude);
}

export function codexAcopilot(raiz) {
  return codexAMd(raiz, DIR_COPILOT, ".agent.md", modelos.codexAcopilot);
}

export function claudeAcomposer(raiz) {
  return mdAmd(raiz, DIR_CLAUDE, ".md", DIR_COMPOSER, ".md", modelos.claudeAcomposer);
}

export function copilotAcomposer(raiz) {
  return mdAmd(raiz, DIR_COPILOT, ".agent.md", DIR_COMPOSER, ".md", modelos.copilotAcomposer);
}

export function composerAclaude(raiz) {
  return mdAmd(raiz, DIR_COMPOSER, ".md", DIR_CLAUDE, ".md", modelos.composerAclaude);
}

export function composerAcopilot(raiz) {
  return mdAmd(raiz, DIR_COMPOSER, ".md", DIR_COPILOT, ".agent.md", modelos.composerAcopilot);
}

export function composerAcodex(raiz) {
  return mdACodex(raiz, DIR_COMPOSER, ".md", modelos.composerAcodex);
}

export function codexAcomposer(raiz) {
  return codexAMd(raiz, DIR_COMPOSER, ".md", modelos.codexAcomposer);
}