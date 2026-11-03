#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CineScope / MovieBox — Automated Let's Encrypt SSL Setup via Certbot
# Usage:
#   sudo ./setup-ssl.sh yourdomain.com you@email.com
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ]; then
    echo "============================================================"
    echo "❌ Error: Missing domain name!"
    echo "Usage: sudo ./setup-ssl.sh <yourdomain.com> [your-email@example.com]"
    echo ""
    echo "Example: sudo ./setup-ssl.sh cinescope.live admin@cinescope.live"
    echo "============================================================"
    exit 1
fi

echo "=== [1/4] Ensuring Firewall Allows Ports 80 and 443 ==="
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo netfilter-persistent save || true

echo "=== [2/4] Installing Certbot and Python Nginx Plugin ==="
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx

echo "=== [3/4] Requesting SSL Certificate for $DOMAIN ==="
EMAIL_FLAG="--register-unsafely-without-email"
if [ -n "$EMAIL" ]; then
    EMAIL_FLAG="--email $EMAIL --no-eff-email"
fi

sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos $EMAIL_FLAG --redirect

echo "=== [4/4] Testing Nginx Configuration & Reloading ==="
sudo nginx -t
sudo systemctl reload nginx

# Set up auto-renewal cron/systemd timer check
sudo systemctl enable certbot.timer || true
sudo systemctl start certbot.timer || true

echo ""
echo "============================================================"
echo "✅ SSL CERTIFICATE INSTALLED SUCCESSFULLY!"
echo "Your server is now securely running on HTTPS:"
echo "👉 https://$DOMAIN"
echo "Auto-renewal is enabled and will renew every 60-90 days automatically."
echo "============================================================"
