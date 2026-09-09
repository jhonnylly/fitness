#!/usr/bin/env bash
# Levanta el emulador de Firestore y corre test/rules.test.js contra él.
#
# Existe como script y no como una línea en package.json porque hay que
# resolver dos cosas antes de arrancar:
#   1. El emulador exige Java 11+, y en este equipo el java del PATH es el 8.
#      El 11 está instalado, solo que no es el de por defecto: se busca aquí en
#      vez de pedirle a nadie que cambie el java del sistema.
#   2. Si falta Java o firebase-tools, esto NO puede fallar: avisa y sale con 0,
#      igual que test:ui cuando no hay puppeteer. Quien solo quiera correr las
#      pruebas de datos no debe encontrarse un muro.
set -u
cd "$(dirname "$0")/.." || exit 0

# ── Java 11+ ──
version_java() { "$1" -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+)(\.([0-9]+))?.*/\1 \3/'; }
sirve() {
  [ -x "$1" ] || return 1
  local v; v=$(version_java "$1")
  local mayor=${v%% *} menor=${v##* }
  [ "$mayor" = "1" ] && mayor=$menor          # "1.8" es Java 8
  [ -n "$mayor" ] && [ "$mayor" -ge 11 ] 2>/dev/null
}

JAVA_BIN=""
if sirve "$(command -v java 2>/dev/null)"; then
  JAVA_BIN=$(command -v java)
else
  for d in /usr/lib/jvm/*/bin/java; do
    if sirve "$d"; then JAVA_BIN="$d"; break; fi
  done
fi

if [ -z "$JAVA_BIN" ]; then
  echo ""
  echo "⏭  SALTADO: el emulador de Firestore necesita Java 11 o superior."
  echo "   sudo apt install openjdk-17-jre-headless"
  echo ""
  exit 0
fi

if [ ! -x node_modules/.bin/firebase ]; then
  echo ""
  echo "⏭  SALTADO: falta firebase-tools."
  echo "   npm install --no-save firebase-tools@13 @firebase/rules-unit-testing firebase"
  echo ""
  exit 0
fi

export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
export PATH="$JAVA_HOME/bin:$PATH"

exec node_modules/.bin/firebase emulators:exec \
  --only firestore --project demo-fitness "node test/rules.test.js"
