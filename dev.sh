#!/usr/bin/env bash
#
# Paarvix — See your data clearly.
# Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
# Licensed under the GNU Affero General Public License v3.0. See LICENSE.
# Commercial licenses: support@kannantech.com
#
# Development on a laptop, with live updates.
# The database runs in Docker; the API and web app run directly and reload on save.
# Only containers named paarvix-* are ever started or stopped.
#
#   ./dev.sh          start everything (Ctrl+C stops the API and web app)
#   ./dev.sh db       start only the database
#   ./dev.sh stop     stop the database container too
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE=(docker compose --env-file .env -f docker/docker-compose.yml)
DB_CONTAINER=paarvix-postgres

say()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

[ -f .env ] || fail "No .env file. Run ./install.sh once, or copy .env.example to .env and fill it in."
command -v docker >/dev/null || fail "Docker is needed for the database."
command -v node >/dev/null || fail "Node.js is needed. Install Node 22 or newer."

# Load .env so Prisma and the API use the same database as the app.
set -a
# shellcheck disable=SC1091
source .env
set +a

DB_PORT="${POSTGRES_PORT:-5433}"
API_PORT="${API_PORT:-3005}"
WEB_PORT=4200

# Refuse to run if DATABASE_URL points anywhere but Paarvix's own container.
# Other projects' databases on this laptop (for example on 5432) must never be touched.
case "${DATABASE_URL:-}" in
  *"@localhost:${DB_PORT}/paarvix"* | *"@127.0.0.1:${DB_PORT}/paarvix"*) ;;
  *) fail "DATABASE_URL in .env must point to localhost:${DB_PORT}/paarvix (the ${DB_CONTAINER} container). Fix .env first." ;;
esac

port_busy() { ss -ltn "( sport = :$1 )" 2>/dev/null | grep -q LISTEN; }

start_db() {
  if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" = "true" ]; then
    ok "Database already running (${DB_CONTAINER}, port ${DB_PORT})"
  else
    say "Starting database (${DB_CONTAINER}, port ${DB_PORT})"
    "${COMPOSE[@]}" up -d postgres >/dev/null
  fi
  for _ in $(seq 1 30); do
    docker exec "$DB_CONTAINER" pg_isready -U paarvix -d paarvix >/dev/null 2>&1 && { ok "Database ready"; return; }
    sleep 1
  done
  fail "Database did not become ready. See: docker logs ${DB_CONTAINER}"
}

case "${1:-}" in
  db) start_db; exit 0 ;;
  stop)
    say "Stopping ${DB_CONTAINER}"
    docker stop "$DB_CONTAINER" >/dev/null 2>&1 || true
    ok "Stopped"
    exit 0 ;;
  "" ) ;;
  *) fail "Unknown option '$1'. Use: ./dev.sh, ./dev.sh db or ./dev.sh stop" ;;
esac

# The Docker API and web containers use the same ports, so they must be stopped first.
for c in paarvix-api paarvix-web; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || true)" = "true" ]; then
    say "Stopping Docker container ${c}, which would use the same port"
    docker stop "$c" >/dev/null
  fi
done

# Old Paarvix dev servers left running (another terminal, a crash) are stopped.
# A process is only stopped if it runs from this Paarvix folder; another project's server is never touched.
# Stops a process and its children only, so nothing else started from the same terminal is affected.
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}

# Climbs from the process holding the port to the topmost Paarvix process (npm, nest --watch, ng serve),
# so a watcher cannot restart the server. Never climbs into a shell, so the user's terminal is never stopped.
paarvix_root_of() {
  local pid=$1 parent pcwd pcomm
  while :; do
    parent=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [ -z "$parent" ] || [ "$parent" -le 1 ] && break
    pcomm=$(ps -o comm= -p "$parent" 2>/dev/null)
    # Allow-list: only Node tooling and the non-interactive "sh -c" npm uses to run scripts.
    # Anything else (an interactive shell, an editor, Claude Code) is where the climb stops.
    case "$pcomm" in
      node|npm*|npx*|MainThread|ng*|nest*) ;;
      sh|dash) ps -o args= -p "$parent" 2>/dev/null | grep -q -- ' -c ' || break ;;
      *) break ;;
    esac
    pcwd=$(readlink "/proc/${parent}/cwd" 2>/dev/null || true)
    case "$pcwd" in "$ROOT"|"$ROOT"/*) pid=$parent ;; *) break ;; esac
  done
  echo "$pid"
}

free_port() {
  local port=$1 pids pid cwd
  pids=$(ss -ltnpH "( sport = :${port} )" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
  [ -z "$pids" ] && return 0
  for pid in $pids; do
    cwd=$(readlink "/proc/${pid}/cwd" 2>/dev/null || true)
    case "$cwd" in
      "$ROOT"|"$ROOT"/*)
        local top; top=$(paarvix_root_of "$pid")
        say "Stopping an old Paarvix server on port ${port} (process ${top})"
        kill_tree "$top" ;;
      *)
        fail "Port ${port} is used by a program outside Paarvix (process ${pid}, folder ${cwd:-unknown}). Stop it yourself or change the port." ;;
    esac
  done
  for _ in $(seq 1 20); do port_busy "$port" || return 0; sleep 0.5; done
  for pid in $(ss -ltnpH "( sport = :${port} )" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true); do
    kill -KILL "$pid" 2>/dev/null || true
  done
  sleep 1
  port_busy "$port" && fail "Could not free port ${port}."
  return 0
}

if port_busy "$API_PORT" || port_busy "$WEB_PORT"; then
  if ! ss -ltnpH "( sport = :${API_PORT} or sport = :${WEB_PORT} )" 2>/dev/null | grep -q 'pid='; then
    fail "Ports ${API_PORT} or ${WEB_PORT} are in use, but this user cannot see which program holds them. Stop it, then run ./dev.sh again."
  fi
fi
free_port "$API_PORT"
free_port "$WEB_PORT"
ok "Ports ${API_PORT} and ${WEB_PORT} are free"

if [ ! -d node_modules ]; then
  say "Installing dependencies (first run only)"
  npm install --legacy-peer-deps
fi

start_db

say "Preparing database schema"
./node_modules/.bin/prisma generate >/dev/null
# No --accept-data-loss: if a change would delete data, this stops and tells you instead.
./node_modules/.bin/prisma db push >/dev/null || fail "Schema change would lose data or failed. Read the message above; nothing was changed."
ok "Schema up to date"

say "Building shared types"
(cd packages/shared && npx tsc) || fail "Shared types did not compile"
ok "Shared types built"

LOG_DIR="${ROOT}/.dev-logs"
mkdir -p "$LOG_DIR"

cleanup() {
  trap - INT TERM EXIT
  echo
  say "Stopping API and web app"
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

say "Starting API on http://localhost:${API_PORT} (reloads on save)"
(cd apps/api && npx nest start --watch 2>&1 | tee "${LOG_DIR}/api.log" | sed -u 's/^/[api] /') &

say "Starting web app on http://localhost:${WEB_PORT} (reloads on save)"
(cd apps/web && npx ng serve --port "$WEB_PORT" 2>&1 | tee "${LOG_DIR}/web.log" | sed -u 's/^/[web] /') &

for _ in $(seq 1 90); do
  if curl -fs "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1 && curl -fs "http://localhost:${WEB_PORT}/" >/dev/null 2>&1; then
    echo
    ok "Paarvix is running: open http://localhost:${WEB_PORT}"
    echo "   Logs: .dev-logs/api.log and .dev-logs/web.log. Press Ctrl+C to stop."
    echo
    break
  fi
  sleep 2
done

wait
