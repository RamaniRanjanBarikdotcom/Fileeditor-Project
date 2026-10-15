#!/bin/sh
set -eu

api_url="${API_URL:-http://localhost:4201/api/v1}"
origin="${ORIGIN:-http://localhost:5173}"
email="smoke-$(date +%s)@example.test"
password="SmokeTest123!"
output_file="$(mktemp /tmp/docconv-smoke.XXXXXX.pdf)"
events_file="$(mktemp /tmp/docconv-smoke-events.XXXXXX)"
trap 'rm -f "$output_file" "$events_file"' EXIT

register_response="$(
  curl -fsS -X POST "$api_url/auth/register" \
    -H "Origin: $origin" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\",\"organizationName\":\"Smoke Test\"}"
)"
token="$(printf '%s' "$register_response" | jq -er '.data.accessToken')"

file_response="$(
  curl -fsS -X POST "$api_url/files/paste" \
    -H "Origin: $origin" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data '{"format":"html","content":"<!doctype html><html><body><h1>Conversion smoke test</h1><p>The complete API, queue, worker, Gotenberg, storage, and download path is working.</p></body></html>"}'
)"
file_id="$(printf '%s' "$file_response" | jq -er '.data.id')"

conversion_response="$(
  curl -fsS -X POST "$api_url/conversions" \
    -H "Origin: $origin" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data "{\"sourceFileId\":\"$file_id\",\"targetFormat\":\"pdf\"}"
)"
conversion_id="$(printf '%s' "$conversion_response" | jq -er '.data.id')"

curl -fsS -N --max-time 90 "$api_url/conversions/$conversion_id/events" \
  -H "Origin: $origin" \
  -H 'Accept: text/event-stream' \
  -H "Authorization: Bearer $token" \
  -o "$events_file"

status_response="$(awk '/^data:/{sub(/^data:[[:space:]]*/, ""); latest=$0} END{print latest}' "$events_file")"
status="$(printf '%s' "$status_response" | jq -er '.status')"

if [ "$status" != "COMPLETED" ]; then
  printf 'Conversion failed with status %s: %s\n' \
    "$status" \
    "$(printf '%s' "$status_response" | jq -r '.errorMessage // "unknown error"')" >&2
  exit 1
fi

download_response="$(
  curl -fsS -X POST "$api_url/conversions/$conversion_id/download-url" \
    -H "Origin: $origin" \
    -H "Authorization: Bearer $token"
)"
download_url="$(printf '%s' "$download_response" | jq -er '.data.url')"
curl -fsS "$download_url" -o "$output_file"

signature="$(dd if="$output_file" bs=4 count=1 2>/dev/null)"
[ "$signature" = "%PDF" ] || {
  printf 'Output is not a valid PDF (signature: %s)\n' "$signature" >&2
  exit 1
}

size="$(wc -c < "$output_file" | tr -d ' ')"
printf 'PASS html->pdf conversion_id=%s output_bytes=%s\n' "$conversion_id" "$size"
