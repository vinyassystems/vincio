<div align="center">

# Vincio ⚡
### Real-Time Collaborative Workspace, Terminal Execution, & Local AI Hub

[![VSA Banner](https://img.shields.io/badge/VSA-Vincio-indigo?style=for-the-badge)](https://github.com/vinyassystems/vincio)
[![License: MIT](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-Ready-blue?style=for-the-badge)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange?style=for-the-badge)]()

*Engineered and maintained by **Vinyas Systems Automation (VSA)**.*

</div>

---
## 📖 Overview

Vincio is a self-hosted, lightweight real-time collaborative workspace and development hub. Designed for developers, engineering teams, and creators who want total control over their data, Vincio bridges the gap between Google Docs-style real-time collaboration, a live integrated terminal, and local AI model auto-discovery — all running securely on your own hardware.

## ✨ Core Features

- 🤖 **Local AI Auto-Discovery** — Automatically detects local open-source models (via Ollama, like qwen2.5-coder) or allows custom API bindings.
- ⚡ **Live Code Auto-Sync** — AI-generated code blocks instantly extract and sync across all connected clients via WebSockets in real time.
- 🖥️ **Host Terminal Integration** — Execute system commands directly from the dashboard, securely protected by admin session control.
- 👥 **Real-Time Team Hub** — Synchronized live chat, editable/deletable messages, and connected user tracking.
- 📁 **Integrated Shared Drive** — Manage project assets directly within the interface and download entire directories as ZIP archives instantly.
- 🔒 **Zero Cloud Lock-in** — Host locally and expose securely via tunnels (such as Cloudflare) without relying on heavy commercial third-party cloud infrastructure.

## ⚙️ System Architecture

```
[ Client Browsers ] <--- WebSocket / HTTP ---> [ Node.js Express Server ]
                                                          |
         +-----------------------+------------------------+
         |                       |                        |
 [ Local Terminal ]     [ Ollama Local AI ]      [ Shared File Drive ]
```

---

## 🚀 Download & Installation Guide

### Prerequisites

Before downloading and running Vincio, ensure your system has the following installed:

- **Node.js** (v18 or higher recommended)
- **Git** (for cloning the repository)
- **Ollama** (optional, if you want local AI model integration)
- **cloudflared** (optional, if you want to expose your local instance securely via a Cloudflare Tunnel) — see install steps below

### Installing cloudflared (optional, for secure remote access)

Vincio can be exposed outside your local network without opening ports, using a Cloudflare Tunnel. Install `cloudflared` for your OS:

**Windows (via winget):**

```bash
winget install --id Cloudflare.cloudflared
```

**macOS (via Homebrew):**

```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux / Ubuntu / WSL:**

```bash
sudo mkdir -p --parents --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

Once installed, you can start a tunnel to your local Vincio server with:

```bash
cloudflared tunnel --url http://localhost:8000
```

### Step-by-Step Installation

Vincio runs the same way on **macOS, Windows, and Linux** — the only difference is which terminal you use (Terminal on macOS/Linux, PowerShell or Command Prompt on Windows).

1. **Clone the repository**

   ```bash
   git clone https://github.com/vinyassystems/vincio.git
   ```

2. **Navigate into the project folder**

   ```bash
   cd vincio
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Start the application server**

   ```bash
   npm start
   ```

5. **Access the workspace**

   Open your web browser and navigate to:

   ```
   http://localhost:8000
   ```

   Enter your admin password in the terminal prompt when initializing, and your workspace is fully live!

## 📄 License

MIT License




