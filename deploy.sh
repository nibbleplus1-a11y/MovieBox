#!/bin/bash
set -e

echo "=== [1/5] Configuring Firewall (Port 80, 443, 8000) ==="
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT || true

sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent netfilter-persistent
sudo netfilter-persistent save

echo "=== [2/5] Installing System Dependencies (Python, Git, Nginx) ==="
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-venv git nginx curl

echo "=== [3/5] Setting up MovieBox Codebase ==="
if [ ! -d "/home/ubuntu/MovieBox" ]; then
    git clone https://github.com/nibbleplus1-a11y/MovieBox.git /home/ubuntu/MovieBox
else
    cd /home/ubuntu/MovieBox
    git fetch origin
    git reset --hard origin/main
fi

cd /home/ubuntu/MovieBox

echo "=== [4/5] Setting up Virtual Environment & Python Packages ==="
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

echo "=== [5/5] Configuring Nginx & MovieBox 24/7 System Service ==="
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo nginx -t
sudo systemctl restart nginx

sudo tee /etc/systemd/system/moviebox.service > /dev/null << 'EOF'
[Unit]
Description=MovieBox Streaming Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/MovieBox
ExecStart=/home/ubuntu/MovieBox/venv/bin/python -m uvicorn api:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable moviebox
sudo systemctl restart moviebox

sleep 3
echo "Checking service status..."
systemctl --no-pager status moviebox

echo ""
echo "============================================================"
echo "✅ DEPLOYMENT SUCCESSFUL! MovieBox is running on port 80!"
echo "Visit: http://137.23.40.164 in your browser!"
echo "============================================================"
