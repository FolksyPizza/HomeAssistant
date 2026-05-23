#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="${CERT_DIR:-.cert}"
KEY_FILE="${DEV_HTTPS_KEY_FILE:-$CERT_DIR/dev-key.pem}"
CERT_FILE="${DEV_HTTPS_CERT_FILE:-$CERT_DIR/dev-cert.pem}"
HOSTS="${DEV_CERT_HOSTS:-localhost,127.0.0.1,0.0.0.0,raspberrypi,raspberrypi.local}"

mkdir -p "$CERT_DIR"

SAN_ENTRIES=()
IFS=',' read -ra HOST_ARRAY <<< "$HOSTS"
for host in "${HOST_ARRAY[@]}"; do
	host_trimmed="$(echo "$host" | xargs)"
	if [[ -z "$host_trimmed" ]]; then
		continue
	fi

	if [[ "$host_trimmed" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		SAN_ENTRIES+=("IP:$host_trimmed")
	else
		SAN_ENTRIES+=("DNS:$host_trimmed")
	fi
done

SAN_VALUE="$(IFS=,; echo "${SAN_ENTRIES[*]}")"
CONFIG_FILE="$(mktemp)"

cat >"$CONFIG_FILE" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
CN = Raspberry Pi Smart Display Dev

[req_ext]
subjectAltName = $SAN_VALUE

[v3_ext]
subjectAltName = $SAN_VALUE
EOF

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
	-keyout "$KEY_FILE" \
	-out "$CERT_FILE" \
	-config "$CONFIG_FILE" \
	-extensions v3_ext

rm -f "$CONFIG_FILE"

echo "Created dev certificate:"
echo "  cert: $CERT_FILE"
echo "  key:  $KEY_FILE"
echo "Hosts:"
printf '  - %s\n' "${HOST_ARRAY[@]}"
