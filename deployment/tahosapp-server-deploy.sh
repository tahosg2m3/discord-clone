#!/usr/bin/env bash
set -Eeuo pipefail

release_id="${1:-}"
backend_archive="${2:-}"
web_archive="${3:-}"
update_archive="${4:--}"
installer_name="${5:--}"

if [[ ! "$release_id" =~ ^[0-9]{8}-[0-9]{6}$ ]]; then
  echo "Gecersiz surum kimligi." >&2
  exit 2
fi

for archive_path in "$backend_archive" "$web_archive"; do
  if [[ "$archive_path" != /tmp/tahosapp-* || ! -f "$archive_path" ]]; then
    echo "Gecersiz veya eksik arsiv: $archive_path" >&2
    exit 2
  fi
done

backend_release="/opt/tahosapp/releases/$release_id"
web_release="/var/www/tahosapp-web/releases/$release_id"
update_release="/var/www/tahosapp-updates/releases/$release_id"
previous_backend="$(readlink -f /opt/tahosapp/current 2>/dev/null || true)"
previous_web="$(readlink -f /var/www/tahosapp-web/current 2>/dev/null || true)"
previous_update="$(readlink -f /var/www/tahosapp-updates/current 2>/dev/null || true)"

exec 9>/var/lock/tahosapp-deploy.lock
if ! flock -n 9; then
  echo "Baska bir dagitim halen calisiyor." >&2
  exit 3
fi

if [[ -e "$backend_release" || -e "$web_release" || -e "$update_release" ]]; then
  echo "Bu surum kimligi daha once kullanilmis." >&2
  exit 4
fi

install -d -m 0755 "$backend_release" "$web_release"
tar -xzf "$backend_archive" -C "$backend_release"
tar -xzf "$web_archive" -C "$web_release"
chown -R tahosapp:tahosapp "$backend_release"

if [[ "$update_archive" != "-" ]]; then
  if [[ "$update_archive" != /tmp/tahosapp-updates-*.tar.gz || ! -f "$update_archive" ]]; then
    echo "Otomatik guncelleme arsivi gecersiz." >&2
    exit 5
  fi
  if [[ ! "$installer_name" =~ ^tahosapp-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe$ ]]; then
    echo "Kurulum dosyasi adi gecersiz." >&2
    exit 5
  fi
  install -d -m 0755 "$update_release"
  tar --no-same-owner --no-same-permissions -xzf "$update_archive" -C "$update_release"
  for required_file in latest.yml "$installer_name" "$installer_name.blockmap"; do
    if [[ ! -f "$update_release/$required_file" ]]; then
      echo "Otomatik guncelleme dosyasi eksik: $required_file" >&2
      exit 5
    fi
  done
fi

sudo -u tahosapp env \
  HOME=/var/lib/tahosapp \
  PATH=/opt/node22/bin:/usr/bin:/bin \
  /opt/node22/bin/npm ci --omit=dev --no-audit --no-fund --prefix "$backend_release"

ln -sfn "$backend_release" /opt/tahosapp/current
ln -sfn "$web_release" /var/www/tahosapp-web/current
if [[ "$update_archive" != "-" ]]; then
  ln -sfn "$update_release" /var/www/tahosapp-updates/current
fi

systemctl restart tahosapp

healthy=false
for _attempt in {1..20}; do
  if curl --fail --silent --show-error http://127.0.0.1:3001/health >/dev/null \
    && curl --fail --silent --show-error http://127.0.0.1:9000/peerjs/peerjs/id >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != true ]]; then
  echo "Yeni surum saglik kontrolunu gecemedi; onceki surume donuluyor." >&2
  if [[ -n "$previous_backend" ]]; then ln -sfn "$previous_backend" /opt/tahosapp/current; fi
  if [[ -n "$previous_web" ]]; then ln -sfn "$previous_web" /var/www/tahosapp-web/current; fi
  if [[ -n "$previous_update" ]]; then
    ln -sfn "$previous_update" /var/www/tahosapp-updates/current
  elif [[ "$update_archive" != "-" ]]; then
    rm -f /var/www/tahosapp-updates/current
  fi
  systemctl restart tahosapp
  exit 6
fi

if [[ "$update_archive" != "-" ]]; then
  install -m 0644 "$update_release/$installer_name" "/var/www/tahosapp/downloads/tahosapp-Setup-latest.exe"
fi

echo "tahosapp $release_id basariyla yayinlandi."
systemctl --no-pager --full status tahosapp | sed -n '1,12p'
