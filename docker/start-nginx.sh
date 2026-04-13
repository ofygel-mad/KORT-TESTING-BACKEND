#!/bin/sh
set -eu

PORT="${PORT:-8080}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"

case "$BACKEND_URL" in
  http://*|https://*)
    ;;
  *)
    BACKEND_URL="https://${BACKEND_URL}"
    ;;
esac

export PORT
export BACKEND_URL

envsubst '${PORT} ${BACKEND_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
