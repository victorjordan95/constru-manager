#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"

# ─── Cores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[constru]${RESET} $*"; }
ok()   { echo -e "${GREEN}[✓]${RESET} $*"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }
die()  { echo -e "${RED}[✗]${RESET} $*"; exit 1; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════╗"
echo "  ║      Constru Manager — Start     ║"
echo "  ╚══════════════════════════════════╝"
echo -e "${RESET}"

# ─── 1. Dependências ─────────────────────────────────────────────────────────
log "Verificando dependências..."

command -v node >/dev/null 2>&1 || die "Node.js não encontrado. Instale em https://nodejs.org"
command -v npm  >/dev/null 2>&1 || die "npm não encontrado."

ok "Node $(node -v) / npm $(npm -v)"

# ─── 2. Instalar pacotes (se necessário) ─────────────────────────────────────
if [ ! -d "$SERVER/node_modules" ]; then
  log "Instalando dependências do server..."
  (cd "$SERVER" && npm install --silent)
  ok "server/node_modules instalado"
fi

if [ ! -d "$CLIENT/node_modules" ]; then
  log "Instalando dependências do client..."
  (cd "$CLIENT" && npm install --silent)
  ok "client/node_modules instalado"
fi

# ─── 3. Gerar Prisma Client ──────────────────────────────────────────────────
log "Gerando Prisma Client..."
(cd "$SERVER" && npx prisma generate --schema src/prisma/schema.prisma 2>&1 | grep -v "^warn") \
  && ok "Prisma Client gerado"

# ─── 4. Verificar conexão com o banco ────────────────────────────────────────
log "Verificando conexão com o banco de dados..."

set +e
DB_CHECK=$(cd "$SERVER" && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect()
  .then(() => { console.log('ok'); return p.\$disconnect(); })
  .catch((e) => { process.stderr.write('fail: ' + e.message + '\n'); process.exit(1); });
" 2>&1)
DB_EXIT=$?
set -e

if [ $DB_EXIT -eq 0 ] && echo "$DB_CHECK" | grep -q "^ok"; then
  ok "Banco acessível"
else
  die "Não foi possível conectar ao banco.\n  Verifique se o PostgreSQL está rodando e as variáveis em server/.env\n  Erro: $DB_CHECK"
fi

# ─── 5. Migrations ───────────────────────────────────────────────────────────
log "Aplicando migrations..."
(cd "$SERVER" && npx prisma migrate deploy --schema src/prisma/schema.prisma 2>&1 | grep -v "^warn")
ok "Migrations aplicadas"

# ─── 6. Seed (apenas se não houver usuários) ─────────────────────────────────
log "Verificando usuários no banco..."

set +e
USER_COUNT=$(cd "$SERVER" && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(n => { console.log(n); return p.\$disconnect(); })
  .catch(() => { console.log('0'); process.exit(1); });
" 2>&1)
set -e

if [ "$USER_COUNT" = "0" ]; then
  log "Nenhum usuário encontrado. Rodando seed..."
  (cd "$SERVER" && npx prisma db seed 2>&1 | grep -v "^warn")
  ok "Seed executado"
else
  ok "Banco já tem $USER_COUNT usuário(s) — seed ignorado"
fi

# ─── 7. Subir servidor (background) ──────────────────────────────────────────
log "Iniciando server (porta 3000)..."
(cd "$SERVER" && npm run dev > "$ROOT/server.log" 2>&1) &
SERVER_PID=$!

# Aguarda o servidor responder (até 20s)
SERVER_READY=0
for i in $(seq 1 20); do
  sleep 1
  if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    ok "Server rodando (PID $SERVER_PID)"
    SERVER_READY=1
    break
  fi
done

if [ $SERVER_READY -eq 0 ]; then
  warn "Server demorou para responder. Últimas linhas do log:"
  tail -5 "$ROOT/server.log" 2>/dev/null || true
fi

# ─── 8. Subir cliente (background) ───────────────────────────────────────────
log "Iniciando client (porta 5173)..."
(cd "$CLIENT" && npm run dev > "$ROOT/client.log" 2>&1) &
CLIENT_PID=$!

sleep 3
ok "Client rodando (PID $CLIENT_PID)"

# ─── 9. Resumo ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  Ambiente pronto!${RESET}"
echo ""
echo -e "  Frontend  →  ${CYAN}http://localhost:5173${RESET}"
echo -e "  Backend   →  ${CYAN}http://localhost:3000${RESET}"
echo ""
echo -e "  Credenciais padrão:"
echo -e "    ADMIN  →  admin@constru.dev   / admin123"
echo -e "    SALES  →  vendas@constru.dev  / sales123"
echo ""
echo -e "  Logs:"
echo -e "    Server  →  server.log"
echo -e "    Client  →  client.log"
echo ""
echo -e "  Para parar: Ctrl+C"
echo ""

# Mantém vivo e encerra processos filhos no Ctrl+C
trap "echo ''; log 'Encerrando...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; ok 'Ambiente encerrado.'; exit 0" INT TERM
wait
