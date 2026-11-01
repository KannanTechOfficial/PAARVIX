#!/usr/bin/env bash
#
# Paarvix — See your data clearly.
# Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
# Licensed under the GNU Affero General Public License v3.0. See LICENSE.
# Commercial licenses: paarvix@kannantech.com
#
# Control script to manage Paarvix lifecycle (start, stop, restart, logs, status)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

ACTION="${1:-start}"

case "${ACTION}" in
  start)
    exec ./install.sh "${@:2}"
    ;;
  stop)
    echo "Stopping Paarvix services..."
    if command -v docker >/dev/null 2>&1; then
      docker compose --env-file .env -f docker/docker-compose.yml down
    fi
    echo "Paarvix stopped."
    ;;
  restart)
    echo "Restarting Paarvix services..."
    if command -v docker >/dev/null 2>&1; then
      docker compose --env-file .env -f docker/docker-compose.yml restart
    fi
    echo "Paarvix restarted."
    ;;
  logs)
    docker compose --env-file .env -f docker/docker-compose.yml logs -f "${@:2}"
    ;;
  status)
    docker compose --env-file .env -f docker/docker-compose.yml ps
    ;;
  *)
    echo "Usage: ./run.sh [start|stop|restart|logs|status]"
    exit 1
    ;;
esac

