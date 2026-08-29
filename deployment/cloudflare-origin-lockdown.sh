#!/usr/bin/env bash
set -Eeuo pipefail

# Run as root on the production host. This intentionally changes only web
# ports; SSH and the TURN voice ports remain untouched.
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Bu betik root olarak çalıştırılmalıdır." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT
curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
  https://www.cloudflare.com/ips-v4 > "$tmp_dir/ips-v4"
curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
  https://www.cloudflare.com/ips-v6 > "$tmp_dir/ips-v6"

validate_ranges() {
  local file="$1" family="$2"
  [[ -s "$file" ]] || return 1
  if [[ "$family" == 4 ]]; then
    ! grep -Ev '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$' "$file" | grep -q .
  else
    ! grep -Ev '^[0-9A-Fa-f:]+/[0-9]{1,3}$' "$file" | grep -q .
  fi
}

validate_ranges "$tmp_dir/ips-v4" 4 || { echo 'Cloudflare IPv4 listesi doğrulanamadı.' >&2; exit 2; }
validate_ranges "$tmp_dir/ips-v6" 6 || { echo 'Cloudflare IPv6 listesi doğrulanamadı.' >&2; exit 2; }

while IFS= read -r range || [[ -n "$range" ]]; do
  ufw allow proto tcp from "$range" to any port 80,443 comment 'Cloudflare origin'
done < "$tmp_dir/ips-v4"

while IFS= read -r range || [[ -n "$range" ]]; do
  ufw allow proto tcp from "$range" to any port 80,443 comment 'Cloudflare origin'
done < "$tmp_dir/ips-v6"

# Remove only the old world-open web rules. `--force` suppresses prompts; an
# absent rule is harmless because the allow-list was installed first.
ufw --force delete allow 80/tcp 2>/dev/null || true
ufw --force delete allow 443/tcp 2>/dev/null || true
ufw reload
ufw status numbered
