#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ATR Inventory Dashboard — Mac Mini Server Setup
# Run once on a fresh Mac Mini to install everything needed to host the app.
#
# Usage:
#   chmod +x setup-mac-mini.sh
#   ./setup-mac-mini.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # exit on any error

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"  # monorepo root
APP_DIR="$REPO_DIR/apps/inventory"
PIPELINE_DIR="$APP_DIR/pipeline"
CLOUDFLARE_TUNNEL_ID="16528d92-6c21-4503-8205-28045fb94968"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ATR Inventory Dashboard — Mac Mini Setup           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Homebrew ───────────────────────────────────────────────────────────────
echo "▶ Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  echo "  Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
else
  echo "  ✓ Homebrew already installed"
fi

# ── 2. Bun ───────────────────────────────────────────────────────────────────
echo "▶ Checking Bun..."
if ! command -v bun &>/dev/null; then
  echo "  Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  # Load bun into current session
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
else
  echo "  ✓ Bun $(bun --version) already installed"
fi

# ── 3. Python ────────────────────────────────────────────────────────────────
echo "▶ Checking Python 3..."
if ! command -v python3 &>/dev/null; then
  echo "  Installing Python via Homebrew..."
  brew install python
else
  echo "  ✓ $(python3 --version) already installed"
fi

# ── 4. Python pipeline dependencies ──────────────────────────────────────────
echo "▶ Installing Python pipeline dependencies..."
pip3 install -r "$PIPELINE_DIR/requirements.txt"
echo "  ✓ Python packages installed"

# ── 5. Bun / Node dependencies ───────────────────────────────────────────────
echo "▶ Installing JavaScript dependencies..."
cd "$REPO_DIR"
bun install
echo "  ✓ bun install complete"

# ── 6. pm2 for process management ────────────────────────────────────────────
echo "▶ Checking pm2..."
if ! command -v pm2 &>/dev/null; then
  echo "  Installing pm2..."
  npm install -g pm2
else
  echo "  ✓ pm2 already installed"
fi

# ── 7. cloudflared ────────────────────────────────────────────────────────────
echo "▶ Checking cloudflared..."
if ! command -v cloudflared &>/dev/null; then
  echo "  Installing cloudflared via Homebrew..."
  brew install cloudflared
else
  echo "  ✓ cloudflared already installed"
fi

# ── 8. .env check ────────────────────────────────────────────────────────────
echo ""
echo "▶ Checking .env file..."
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "  ⚠  No .env found. Copying .env.example — fill in your credentials before starting."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
else
  echo "  ✓ .env already exists"
fi

# ── 9. Build the Nuxt app ────────────────────────────────────────────────────
echo ""
echo "▶ Building the inventory app..."
cd "$APP_DIR"
bun run build
echo "  ✓ Build complete — output at apps/inventory/.output/"

# ── 10. Register pm2 process ─────────────────────────────────────────────────
echo ""
echo "▶ Setting up pm2 process..."
pm2 stop inventory 2>/dev/null || true
pm2 start \
  --name inventory \
  --interpreter bun \
  "$APP_DIR/.output/server/index.mjs"
pm2 save
echo "  ✓ pm2 process 'inventory' started on port 3002"

# ── 11. Cloudflare Tunnel setup ───────────────────────────────────────────────
echo ""
echo "▶ Cloudflare Tunnel setup..."
echo ""
echo "  You need to copy two files from your Windows machine to this Mac:"
echo "  Windows: C:\\Users\\Mac\\.cloudflared\\$CLOUDFLARE_TUNNEL_ID.json"
echo "  Windows: C:\\Users\\Mac\\.cloudflared\\config.yml"
echo ""
echo "  Copy them to: $HOME/.cloudflared/"
echo ""
echo "  Then run:  sudo cloudflared service install"
echo "  This installs the tunnel as a Mac launchd service (auto-starts on boot)."
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Setup complete!                                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  App running at:  http://localhost:3002              ║"
echo "║  Public URL:      https://inventory.ryptest.com      ║"
echo "║                   (once tunnel is configured)        ║"
echo "║                                                      ║"
echo "║  Useful commands:                                    ║"
echo "║    pm2 status          — check app health            ║"
echo "║    pm2 logs inventory  — view app logs               ║"
echo "║    pm2 restart inventory — restart after code pull   ║"
echo "║                                                      ║"
echo "║  To deploy updates:                                  ║"
echo "║    git pull                                          ║"
echo "║    bun install                                       ║"
echo "║    cd apps/inventory && bun run build                ║"
echo "║    pm2 restart inventory                             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
