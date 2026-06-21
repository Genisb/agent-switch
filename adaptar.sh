#!/bin/bash
#
# adaptar.sh — traduce TODA la infraestructura de IA entre Claude Code,
# GitHub Copilot y Codex.
#
# Uso:
#   ./adaptar.sh claude
#   ./adaptar.sh copilot
#   ./adaptar.sh codex
#   ./adaptar.sh composer
#   ./adaptar.sh estado

set -e

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELO="$1"

mostrar_ayuda() {
  echo ""
  echo "Uso: ./adaptar.sh <modelo>"
  echo ""
  echo "Traduce TODA la infraestructura de IA del proyecto:"
  echo "manual, skills, subagentes y hooks."
  echo ""
  echo "Modelos disponibles:"
  echo "  claude    → activa .claude/ + CLAUDE.md"
  echo "  copilot   → activa .github/"
  echo "  codex     → activa AGENTS.md + .codex/"
  echo "  estado    → muestra qué infraestructura existe ahora mismo"
  echo "  composer  → activa .cursor/ para Cursor Composer 2"
  echo ""
  echo "Ejemplo: ./adaptar.sh codex"
  echo ""
}

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Hace falta Node.js instalado para ejecutar el traductor."
  exit 1
fi

case "$MODELO" in
  claude|copilot|codex|composer|estado)
    node "$RAIZ/scripts/traducir.js" "$MODELO"
    ;;
  "")
    echo "✗ Falta indicar el modelo."
    mostrar_ayuda
    exit 1
    ;;
  *)
    echo "✗ No reconozco '$MODELO' como modelo válido."
    mostrar_ayuda
    exit 1
    ;;
esac

# El git hook de seguridad se mantiene siempre, sin importar el modelo.
if [ -d "$RAIZ/.git" ] && [ -f "$RAIZ/scripts/proteger-secretos.sh" ]; then
  cp "$RAIZ/scripts/proteger-secretos.sh" "$RAIZ/.git/hooks/pre-commit"
  chmod +x "$RAIZ/.git/hooks/pre-commit"
fi