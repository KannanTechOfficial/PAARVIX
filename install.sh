#!/usr/bin/env bash
#
# Paarvix — See your data clearly.
# Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
# Licensed under the GNU Affero General Public License v3.0. See LICENSE.
# Commercial licenses: paarvix@kannantech.com
#
# One-command installer and runner for Paarvix.
#
set -euo pipefail

# Colors
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_BLUE='\033[38;2;30;58;138m'     # #1E3A8A Deep Blue
C_TEAL='\033[38;2;20;184;166m'    # #14B8A6 Teal
C_ORANGE='\033[38;2;249;115;22m'  # #F97316 Orange
C_GREEN='\033[32m'
C_RED='\033[31m'
C_GRAY='\033[90m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

banner() {
  cat << "EOF"

  ____                                _
 |  _ \  __ _   __ _  _ __ __   __ (_)__  __
 | |_) |/ _` | / _` || '__|\ \ / / | |\ \/ /
 |  __/| (_| || (_| || |    \ V /  | | >  <
 |_|    \__,_| \__,_||_|     \_/   |_|/_/\_\

EOF
  echo -e "${C_BOLD}${C_TEAL} See your data clearly.${C_RESET}"
  echo -e "${C_GRAY} Open-source, AI-native real-time analytics platform${C_RESET}"
  echo -e "${C_GRAY} Developed by KannanTech (https://kannantech.com)${C_RESET}"
  echo ""
}

info() {
  echo -e "${C_BOLD}${C_BLUE}ℹ${C_RESET}  $1"
}

success() {
  echo -e "${C_BOLD}${C_GREEN}✔${C_RESET}  $1"
}

warn() {
  echo -e "${C_BOLD}${C_ORANGE}⚠${C_RESET}  $1"
}

error() {
  echo -e "${C_BOLD}${C_RED}✖${C_RESET}  $1" >&2
}

generate_secrets() {
  if [ ! -f ".env" ]; then
    info "Creating .env configuration file from .env.example..."
    cp .env.example .env

    # Generate cryptographically secure random secrets
    local jwt_secret
    local jwt_refresh_secret
    local enc_key

    if command -v openssl >/dev/null 2>&1; then
      jwt_secret=$(openssl rand -hex 32)
      jwt_refresh_secret=$(openssl rand -hex 32)
      enc_key=$(openssl rand -hex 16)
    else
      jwt_secret=$(head -c 32 /dev/urandom | xxd -p -c 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
      jwt_refresh_secret=$(head -c 32 /dev/urandom | xxd -p -c 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
      enc_key=$(head -c 16 /dev/urandom | xxd -p -c 16 2>/dev/null || date +%s%N | sha256sum | head -c 32)
    fi

    # Replace placeholder secrets
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${jwt_refresh_secret}|" .env
    sed -i "s|PAARVIX_ENCRYPTION_KEY=.*|PAARVIX_ENCRYPTION_KEY=${enc_key}|" .env

    success "Generated secure cryptographic secrets in .env"
  else
    info ".env file already exists, preserving existing secrets."
  fi
}

start_docker() {
  info "Checking Docker and Docker Compose..."
  if ! command -v docker >/dev/null 2>&1; then
    error "Docker is not installed. Please install Docker or run './install.sh --local'"
    exit 1
  fi

  info "Starting Paarvix stack with Docker Compose..."
  docker compose --env-file .env -f docker/docker-compose.yml up -d --build

  info "Waiting for database and API to become healthy..."
  local retries=30
  local count=0
  until curl -sf http://localhost:3000/api/health >/dev/null 2>&1 || [ $count -ge $retries ]; do
    sleep 2
    count=$((count + 1))
    echo -n "."
  done
  echo ""

  if [ $count -lt $retries ]; then
    success "All Paarvix services are online!"
  else
    warn "Services are starting up in the background. Check logs with 'docker compose --env-file .env -f docker/docker-compose.yml logs -f'"
  fi

  print_ready_banner "http://localhost:4200" "http://localhost:3000/api"
}

start_local() {
  info "Running in local development mode (bare-metal)..."

  # Check Node.js
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is required but not installed (v20+ recommended)."
    exit 1
  fi
  local node_version
  node_version=$(node -v)
  info "Found Node.js ${node_version}"

  # Install root and workspace dependencies if needed
  if [ ! -d "node_modules" ] || [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
    info "Installing dependencies across monorepo..."
    npm install --legacy-peer-deps
    success "Dependencies installed."
  fi

  # Generate Prisma client and sync schema
  info "Generating Prisma Client and syncing schema..."
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/prisma db push --accept-data-loss

  # Build shared package
  info "Building @paarvix/shared..."
  (cd packages/shared && npm run build)

  # Check if PostgreSQL is reachable or if docker can start it
  if command -v docker >/dev/null 2>&1; then
    info "Ensuring PostgreSQL is running in Docker..."
    docker compose --env-file .env -f docker/docker-compose.yml up postgres -d
    sleep 3
  fi

  # Build API
  info "Building NestJS + Fastify API..."
  (cd apps/api && npm run build)

  # Start API in background and Web in foreground or concurrently
  info "Starting Paarvix API and Web frontend..."

  print_ready_banner "http://localhost:4200" "http://localhost:3000/api"

  # Trap SIGINT and SIGTERM to kill child processes
  trap 'kill 0' SIGINT SIGTERM EXIT

  # Start API in background
  (cd apps/api && npm run start:dev) &
  API_PID=$!

  # Start Angular Web in background
  (cd apps/web && npm start) &
  WEB_PID=$!

  wait $API_PID $WEB_PID
}

print_ready_banner() {
  local web_url="$1"
  local api_url="$2"

  echo ""
  echo -e "${C_BOLD}${C_GREEN}======================================================${C_RESET}"
  echo -e "${C_BOLD}${C_GREEN}      🔭 Paarvix is up and running!                 ${C_RESET}"
  echo -e "${C_BOLD}${C_GREEN}======================================================${C_RESET}"
  echo ""
  echo -e "  ${C_BOLD}Web Dashboard:${C_RESET}   ${C_TEAL}${web_url}${C_RESET}"
  echo -e "  ${C_BOLD}API Gateway:${C_RESET}     ${C_TEAL}${api_url}${C_RESET}"
  echo -e "  ${C_BOLD}Health Check:${C_RESET}    ${C_TEAL}${api_url}/health${C_RESET}"
  echo ""
  echo -e "  ${C_BOLD}First Time?${C_RESET} Open ${C_TEAL}${web_url}/setup${C_RESET} to create your admin account."
  echo ""
}

main() {
  banner
  generate_secrets

  local mode="${1:-}"

  case "${mode}" in
    --local|--dev|-d)
      start_local
      ;;
    --docker|-c|"")
      if command -v docker >/dev/null 2>&1; then
        start_docker
      else
        warn "Docker not detected on this system. Falling back to local mode..."
        start_local
      fi
      ;;
    --help|-h)
      echo "Usage: ./install.sh [OPTION]"
      echo ""
      echo "Options:"
      echo "  (no args)     Auto-detect: use Docker Compose if available, otherwise local"
      echo "  --docker, -c  Run full stack in Docker containers"
      echo "  --local, -d   Run locally (Node.js + PostgreSQL)"
      echo "  --help, -h    Show this help message"
      ;;
    *)
      error "Unknown option: ${mode}"
      echo "Run './install.sh --help' for usage."
      exit 1
      ;;
  esac
}

main "$@"

