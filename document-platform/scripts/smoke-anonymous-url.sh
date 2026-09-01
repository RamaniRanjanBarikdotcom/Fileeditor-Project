#!/bin/sh
set -eu

api_url="${API_URL:-http://localhost:4201/api/v1}"
origin="${ORIGIN:-http://localhost:5173}"
test_url="${TEST_URL:-https://example.com}"
cookie_file="$(mktemp /tmp/toolsuite-anon-cookie.XXXXXX)"
output_file="$(mktemp /tmp/toolsuite-url-output.XXXXXX.pdf)"
trap 'rm -f "$cookie_file" "$output_file"' EXIT

execute_response="$(
  curl -fsS -c "$cookie_file" -b "$cookie_file" \
    -X POST "$api_url/tools/url-to-pdf/execute" \
    -H "Origin: $origin" \
    -F "url=$test_url" \
    -F 'targetFormat=pdf'
)"
job_id="$(printf '%s' "$execute_response" | jq -er '.data.id')"

status="QUEUED"
attempt=0
while [ "$attempt" -lt 90 ]; do
  status_response="$(curl -fsS -c "$cookie_file" -b "$cookie_file" "$api_url/tools/jobs/$job_id")"
  status="$(printf '%s' "$status_response" | jq -er '.data.status')"
  [ "$status" = "COMPLETED" ] && break
  if [ "$status" = "FAILED" ]; then
    printf 'URL conversion failed: %s\n' "$(printf '%s' "$status_response" | jq -r '.data.errorMessage // "unknown error"')" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

[ "$status" = "COMPLETED" ] || {
  printf 'URL conversion timed out with status %s\n' "$status" >&2
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
