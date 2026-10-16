#!/bin/bash
# Publica el cotizador: numera la compilación, la fecha y la nota de cambio (se ven en Más › versión) y hace commit + push.
# Uso:  ./publicar.sh "Qué cambió en esta versión"
cd "$(dirname "$0")" || exit 1
MSG="${1:-Actualización}"
BUILD=$(( $(git rev-list --count HEAD) + 1 ))
FECHA=$(date +%Y-%m-%d)
NOTA=$(printf '%s' "$MSG" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g")
VERSION=$(sed -n "s/.*version: '\([^']*\)'.*/\1/p" version.js | head -1)
cat > version.js <<JS
// Lo escribe publicar.sh en cada publicación: no editar a mano.
window.APP_VERSION = { version: '${VERSION:-2.0}', build: ${BUILD}, fecha: '${FECHA}', nota: '${NOTA}' };
JS
git add -A && git commit -m "$MSG" && git push
