#!/bin/sh
set -eu

api_url="${API_URL:-http://localhost:4201/api/v1}"
email="pdf-url-smoke-$(date +%s)@example.test"
password="SmokeTest123!"
tmp_dir="$(mktemp -d /tmp/docconv-pdf-url.XXXXXX)"
trap 'rm -rf "$tmp_dir"' EXIT

register_response="$(
  curl -fsS -X POST "$api_url/auth/register" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\",\"organizationName\":\"PDF URL Smoke Test\"}"
)"
token="$(printf '%s' "$register_response" | jq -er '.data.accessToken')"

wait_for_conversion() {
  conversion_id="$1"
  attempt=0
  while [ "$attempt" -lt 180 ]; do
    response="$(curl -fsS "$api_url/conversions/$conversion_id" -H "Authorization: Bearer $token")"
    status="$(printf '%s' "$response" | jq -er '.data.status')"
    if [ "$status" = "COMPLETED" ]; then
      return 0
    fi
    if [ "$status" = "FAILED" ]; then
      printf 'Conversion %s failed: %s\n' "$conversion_id" "$(printf '%s' "$response" | jq -r '.data.errorMessage // "unknown error"')" >&2
      return 1
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  printf 'Conversion %s timed out\n' "$conversion_id" >&2
  return 1
}

create_conversion() {
  source_file_id="$1"
  target_format="$2"
  response="$(
    curl -fsS -X POST "$api_url/conversions" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      --data "{\"sourceFileId\":\"$source_file_id\",\"targetFormat\":\"$target_format\"}"
  )"
  printf '%s' "$response" | jq -er '.data.id'
}

download_conversion() {
  conversion_id="$1"
  output_path="$2"
  response="$(
    curl -fsS -X POST "$api_url/conversions/$conversion_id/download-url" \
      -H "Authorization: Bearer $token"
  )"
  url="$(printf '%s' "$response" | jq -er '.data.url')"
  curl -fsS "$url" -o "$output_path"
}

url_file_response="$(
  curl -fsS -X POST "$api_url/files/paste" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data '{"format":"url","content":"https://example.com"}'
)"
url_file_id="$(printf '%s' "$url_file_response" | jq -er '.data.id')"

url_pdf_id="$(create_conversion "$url_file_id" pdf)"
wait_for_conversion "$url_pdf_id"
url_pdf="$tmp_dir/webpage.pdf"
download_conversion "$url_pdf_id" "$url_pdf"
[ "$(dd if="$url_pdf" bs=4 count=1 2>/dev/null)" = "%PDF" ]
printf 'PASS url->pdf bytes=%s\n' "$(wc -c < "$url_pdf" | tr -d ' ')"

url_docx_id="$(create_conversion "$url_file_id" docx)"
wait_for_conversion "$url_docx_id"
url_docx="$tmp_dir/webpage.docx"
download_conversion "$url_docx_id" "$url_docx"
[ "$(dd if="$url_docx" bs=2 count=1 2>/dev/null)" = "PK" ]
printf 'PASS url->docx bytes=%s\n' "$(wc -c < "$url_docx" | tr -d ' ')"

pdf_file_response="$(
  curl -fsS -X POST "$api_url/files/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@$url_pdf;type=application/pdf"
)"
pdf_file_id="$(printf '%s' "$pdf_file_response" | jq -er '.data.id')"

pdf_docx_id="$(create_conversion "$pdf_file_id" docx)"
wait_for_conversion "$pdf_docx_id"
pdf_docx="$tmp_dir/pdf.docx"
download_conversion "$pdf_docx_id" "$pdf_docx"
[ "$(dd if="$pdf_docx" bs=2 count=1 2>/dev/null)" = "PK" ]
printf 'PASS pdf->docx bytes=%s\n' "$(wc -c < "$pdf_docx" | tr -d ' ')"
