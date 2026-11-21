<div align="center">

# Vincio ⚡
### Real-Time Collaborative Workspace, Multi-Language IDE, & Local AI Hub

[![GitHub Stars](https://img.shields.io/github/stars/vinyassystems/vincio?style=for-the-badge&logo=github&color=indigo)](https://github.com/vinyassystems/vincio/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-blue?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](Dockerfile)
[![Ollama Ready](https://img.shields.io/badge/Ollama-Local%20AI-orange?style=for-the-badge&logo=ollama)](https://ollama.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)

<p align="center">
  <b>The open-source, self-hosted peer-to-peer workspace you actually own.</b><br>
  Collaborate in real time, write code across 15+ languages in a VS Code-grade IDE, execute terminal commands, and query local AI models without cloud lock-in.
</p>

[Quick Start](#-quick-start) •
[Why Vincio?](#-why-vincio-vs-alternatives) •
[Features](#-core-features) •
[Architecture](#-system-architecture) •
[Docker](#-docker-setup) •
[Roadmap](#-roadmap)

</div>

---

## 💡 Why Vincio vs Alternatives?

| Feature | **Vincio ⚡** | Replit | VS Code Live Share | Code-Server |
| :--- | :---: | :---: | :---: | :---: |
| **100% Self-Hosted & Private** | **✅ Full Control** | ❌ Cloud-hosted only | ❌ Microsoft relay | ⚠️ Requires VPS |
| **Local AI (Ollama) Out-of-the-Box** | **✅ Auto-discovery** | ❌ Paid cloud tokens | ⚠️ Requires plugins | ❌ Manual config |
| **Multi-Language Monaco Editor** | **✅ Built-in (15+ langs)**| ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Instant PTY Host Terminal** | **✅ Interactive bash/pty** | ✅ Cloud shell | ✅ Shared terminal | ✅ Web shell |
| **1-Click Public Tunnel (Cloudflare)**| **✅ Automatic** | ❌ Paid tier | ❌ Proprietary | ❌ Manual setup |
| **Accountless Quick Sessions** | **✅ Instant Host PIN** | ❌ Account required | ❌ Account required | ⚠️ Password |
| **Shared Drive with Tarball Compression** | **✅ Built-in** | ❌ Proprietary storage | ❌ Local filesystem | ❌ Extra plugin |
| **License / Pricing** | **🆓 100% Free (MIT)** | 💰 \$20+/mo | 🆓 Freemium | 🆓 Open Source |

---

## ✨ Core Features

* 👁️ **Live Split-Screen App Preview (Bolt.new Style)**: Real-time execution iframe rendered right next to the Monaco Editor. Instantly renders HTML, CSS, JavaScript, interactive Canvas games, and web apps with Desktop (100%) and Mobile (375px) responsive viewport toggles.
* 💻 **Multi-Language Monaco IDE Engine**: High-performance editor powered by Monaco (VS Code engine). Includes multi-file tabs, live language switching (JS, Python, TS, HTML, CSS, C++, Rust, Go, Bash, SQL, and more), bracket matching, minimap, and auto-formatting.
* ⚡ **Live Real-Time P2P Code Sync**: Write and edit code together simultaneously with sub-millisecond WebSocket updates.
* 🖥️ **Host Terminal Execution (`node-pty`)**: Run system processes, compile code, execute scripts, or pull files directly into the editor with `sync <filename>`.
* 🤖 **Local AI Auto-Discovery & OmniRouter**: Detects local models running via Ollama (`qwen2.5-coder`, `llama3`, `deepseek-coder`, etc.) automatically on `localhost:11434`, plus support for custom OpenAI-compatible API bindings and automatic multi-file generation directly to disk.
* 🔒 **End-to-End Private 1-on-1 Direct Messaging (DMs)**: Start confidential 1-on-1 chats with any collaborator in the workspace with network-level message isolation.
* 🌐 **Zero-Config Public Tunneling**: Generates an instant, secure public URL via Cloudflare Tunneling—no router port forwarding or public static IP needed.
* 👥 **Team Hub & Developer Presence**: Live online user roster with avatars, roles, message editing, and deletion.
* 📁 **Integrated Shared Drive**: Collaborative asset drive with live folder creation, drag-and-drop file upload, and instant `.tar.gz` archive streaming.

---

## 🚀 Quick Start

### Method 1: Instant Launch with NPX (Zero Install!) ⚡

Run Vincio in any folder immediately without cloning or installing:

```bash
npx vincio
```

Vincio starts immediately, generates a secure 6-digit Host Admin PIN, automatically unlocks your terminal on `http://localhost:8000`, and provides a Cloudflare public link for collaborators.

---

### Method 2: Git & NPM

```bash
# 1. Clone the repository
git clone https://github.com/vinyassystems/vincio.git
cd vincio

# 2. Install dependencies
npm install

# 3. Start the Vincio Studio server
npm start
```

Navigate to **`http://localhost:8000`** in your browser.

---

### Method 2: Docker & Docker Compose 🐳

Run Vincio in an isolated, production-ready container with a single command:

```bash
docker compose up -d
```

Or using standard `docker run`:

```bash
docker build -t vincio .
docker run -d -p 8000:8000 -v $(pwd)/vincio_shared:/app/vincio_shared --name vincio vincio
```

---

## ⚙️ System Architecture

```text
               +-------------------------------------------------------+
               |                  Client Browsers                      |
               |  (Monaco IDE, xterm.js Terminal, Team Hub & Chat UI)  |
               +---------------------------+---------------------------+
                                           | WebSocket / HTTP (Socket.io)
                                           v
               +-------------------------------------------------------+
               |              Vincio Node.js Engine (server.js)        |
               +-------------+-------------+-------------+-------------+
                             |             |             |
        +--------------------+      +------+------+      +--------------------+
        |                           |             |                           |
        v                           v             v                           v
+------------------+       +---------------+ +------------------+   +------------------+
| Host PTY Session |       |  Local Ollama | |  Custom API Hub  |   | Shared File Drive|
| (bash / node-pty)|       | (11434/v1 API)| | (OpenAI, Groq...) |   | (tar streaming)  |
+------------------+       +---------------+ +------------------+   +------------------+
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Enter` / `Cmd + Enter` | **Run Active File** in Host Terminal |
| `Ctrl + S` / `Cmd + S` | **Format & Save / Sync** active file |
| `Ctrl + B` | **Toggle Code Engine Tabs** |
| `Ctrl + C` | **Copy Active Code** to Clipboard |

---

## 🗺️ Roadmap & Upcoming Features

- [x] Multi-Language Monaco IDE with syntax selector & tabs
- [x] Integrated PTY Host Terminal with quick action triggers
- [x] Zero-config Cloudflare tunnel auto-hosting
- [x] Local Ollama model auto-detection
- [ ] Inline AI code completions (Ghost text / Copilot-style)
- [ ] Git commit & push GUI tool inside the studio
- [ ] WebRTC voice channel for peer programming
- [ ] Plugin extension API

Want to help build these features? Check out our [Contribution Guide](CONTRIBUTING.md) and submit a pull request!

---

## 🤝 Contributing

Contributions, issues, and feature requests are very welcome!
Feel free to check the [issues page](https://github.com/vinyassystems/vincio/issues).

1. Star the repo ⭐
2. Fork the project
3. Create your feature branch (`git checkout -b feature/awesome-feature`)
4. Commit your changes (`git commit -m 'feat: add awesome feature'`)
5. Push to the branch (`git push origin feature/awesome-feature`)
6. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  <b>Built with ❤️ by <a href="https://github.com/vinyassystems">Vinyas Systems Automation (VSA)</a></b>
</div>
