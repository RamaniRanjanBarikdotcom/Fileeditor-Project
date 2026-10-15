#!/bin/sh
set -eu

api_url="${API_URL:-http://localhost:4201/api/v1}"
origin="${ORIGIN:-http://localhost:5173}"
test_url="${TEST_URL:-https://example.com}"
cookie_file="$(mktemp /tmp/toolsuite-anon-cookie.XXXXXX)"
output_file="$(mktemp /tmp/toolsuite-url-output.XXXXXX.pdf)"
events_file="$(mktemp /tmp/toolsuite-url-events.XXXXXX)"
trap 'rm -f "$cookie_file" "$output_file" "$events_file"' EXIT

execute_response="$(
  curl -fsS -c "$cookie_file" -b "$cookie_file" \
    -X POST "$api_url/tools/url-to-pdf/execute" \
    -H "Origin: $origin" \
    -F "url=$test_url" \
    -F 'targetFormat=pdf'
)"
job_id="$(printf '%s' "$execute_response" | jq -er '.data.id')"

curl -fsS -N --max-time 120 -c "$cookie_file" -b "$cookie_file" \
  "$api_url/tools/jobs/$job_id/events" \
  -H "Origin: $origin" \
  -H 'Accept: text/event-stream' \
  -o "$events_file"

status_response="$(awk '/^data:/{sub(/^data:[[:space:]]*/, ""); latest=$0} END{print latest}' "$events_file")"
status="$(printf '%s' "$status_response" | jq -er '.status')"

[ "$status" = "COMPLETED" ] || {
  printf 'URL conversion failed with status %s: %s\n' \
    "$status" \
    "$(printf '%s' "$status_response" | jq -r '.errorMessage // "unknown error"')" >&2
  exit 1
}

download_response="$(
  curl -fsS -c "$cookie_file" -b "$cookie_file" \
    -X POST "$api_url/tools/jobs/$job_id/download-url" \
    -H "Origin: $origin"
)"
download_url="$(printf '%s' "$download_response" | jq -er '.data.url')"
curl -fsS "$download_url" -o "$output_file"

signature="$(dd if="$output_file" bs=4 count=1 2>/dev/null)"
[ "$signature" = "%PDF" ] || {
  printf 'Output is not a valid PDF (signature: %s)\n' "$signature" >&2
  exit 1
}

size="$(wc -c < "$output_file" | tr -d ' ')"
printf 'PASS url->pdf job_id=%s output_bytes=%s source=%s\n' "$job_id" "$size" "$test_url"
