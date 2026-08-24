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

**Vincio** is a self-hosted, lightweight real-time collaborative workspace and development hub. Designed for developers, engineering teams, and creators who want total control over their data, Vincio bridges the gap between Google Docs-style real-time collaboration, a live integrated terminal, and local AI model auto-discovery—all running securely on your own hardware.

---

## ✨ Core Features

* **🤖 Local AI Auto-Discovery:** Automatically detects local open-source models (via Ollama like `qwen2.5-coder`) or allows custom API bindings.
* **⚡ Live Code Auto-Sync:** AI-generated code blocks instantly extract and sync across all connected clients via WebSockets in real time.
* **🖥️ Host Terminal Integration:** Execute system commands directly from the dashboard securely protected by admin session control.
* **👥 Real-Time Team Hub:** Features synchronized live chat, editable/deletable messages, and connected user tracking.
* **📁 Integrated Shared Drive:** Manage project assets directly within the interface and download entire directories as ZIP archives instantly.
* **🔒 Zero Cloud Lock-in:** Host locally and expose securely via tunnels (such as Cloudflare) without relying on heavy commercial third-party cloud infrastructure.

---

## ⚙️ System Architecture

```text
  [ Client Browsers ] <--- WebSocket / HTTP ---> [ Node.js Express Server ]
                                                           |
          +-----------------------+------------------------+
          |                       |                        |
  [ Local Terminal ]     [ Ollama Local AI ]      [ Shared File Drive ]





---

🚀 Download & Installation Guide

### Prerequisites
Before downloading and running Vincio, ensure your system has the following installed:
* **Node.js** (v18 or higher recommended)
* **Git** (For cloning the repository)
* **Ollama** (Optional, if you want local AI model integration)

Step-by-Step Installation

Clone the repository
```bash
   git clone https://github.com/vinyassystems/vincio.git
   ```
Navigate into the project folder
```bash
   cd vincio
   ```
Install dependencies
```bash
   npm install
   ```
Start the application server
```bash
   npm start
   ```
Access the workspace
Open your web browser and navigate to:
```
   http://localhost:8000
   ```
Enter your admin password in the terminal prompt when initializing, and your workspace is fully live!



