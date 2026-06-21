// frontmatter.js
// Utilidades para leer y escribir el bloque YAML al inicio de un .md
// (entre las líneas "---"). No usamos una librería YAML completa porque
// nuestros frontmatters son siempre planos: clave: valor, o listas simples
// tipo ["a", "b"]. Esto evita una dependencia externa para algo sencillo.

import fs from "node:fs";

// Lee un archivo .md y separa { frontmatter, cuerpo }.
// frontmatter es un objeto plano JS. cuerpo es el texto Markdown que sigue.
export function leerFrontmatter(ruta) {
  const contenido = fs.readFileSync(ruta, "utf8");
  const match = contenido.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    // No tiene frontmatter: todo es cuerpo.
    return { frontmatter: {}, cuerpo: contenido };
  }

  const [, bloqueYaml, cuerpo] = match;
  const frontmatter = {};

  for (const linea of bloqueYaml.split("\n")) {
    if (!linea.trim() || linea.trim().startsWith("#")) continue;
    const sep = linea.indexOf(":");
    if (sep === -1) continue;

    const clave = linea.slice(0, sep).trim();
    let valor = linea.slice(sep + 1).trim();

    // Listas simples tipo ["read", "grep"]
    if (valor.startsWith("[") && valor.endsWith("]")) {
      valor = valor
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      // Quita comillas si las tiene
      valor = valor.replace(/^["']|["']$/g, "");
    }

    frontmatter[clave] = valor;
  }

  return { frontmatter, cuerpo: cuerpo.replace(/^\n/, "") };
}

// Construye el texto de un .md a partir de { frontmatter, cuerpo }.
export function escribirFrontmatter(frontmatter, cuerpo) {
  const lineas = ["---"];
  for (const [clave, valor] of Object.entries(frontmatter)) {
    if (Array.isArray(valor)) {
      lineas.push(`${clave}: [${valor.map((v) => `"${v}"`).join(", ")}]`);
    } else {
      lineas.push(`${clave}: ${valor}`);
    }
  }
  lineas.push("---", "", cuerpo.trimEnd(), "");
  return lineas.join("\n");
}

// Aviso estándar que se añade a todo archivo generado por el traductor,
// para que nadie lo edite a mano pensando que es la fuente original.
export function avisoGenerado(origen, comando) {
  return `<!-- Generado automáticamente desde ${origen} por traducir.js -->\n<!-- No edites este archivo a mano: edita el original y ejecuta de nuevo ${comando} -->\n`;
}
