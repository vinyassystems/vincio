#!/usr/bin/env node
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const chokidar = require('chokidar');
const { OpenAI } = require('openai');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e7 });

const sharedDir = path.join(process.cwd(), 'vincio_shared');
if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
app.use('/download', express.static(sharedDir)); 

app.get('/download-folder/*', (req, res) => {
    const folderPath = decodeURIComponent(req.params[0]);
    const fullPath = path.join(sharedDir, folderPath);
    
    if (!fullPath.startsWith(sharedDir) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        return res.status(404).send("Folder not found.");
    }
    
    const folderName = path.basename(fullPath);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${folderName}.tar.gz"`);
    
    const tar = spawn('tar', ['-czf', '-', '-C', path.dirname(fullPath), folderName]);
    tar.stdout.pipe(res);
});

app.use(express.static('public'));

const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const ptyProcess = pty.spawn(shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: process.cwd(), env: process.env });

const activeUsers = {};
const activeAiStreams = {};
let guestCounter = 1;
let currentCloudflareLink = "Waiting for tunnel...";

// --- Persistent Config Setup for Password & Local System Username ---
const CONFIG_PATH = path.join(__dirname, '.vincio-config.json');
let sessionAdminPassword = "";
let adminUsername = os.userInfo().username;

function initServerStartup() {
    // 1. Check environment variable override
    const envPass = process.env.ADMIN_PASSWORD || process.env.VINCIO_PASSWORD;
    if (envPass) {
        sessionAdminPassword = envPass.trim();
        bootUpApp();
        return;
    }

    // 2. Check saved persistent configuration
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            if (configData.password) {
                sessionAdminPassword = configData.password;
                if (configData.username) adminUsername = configData.username;
                bootUpApp();
                return;
            }
        } catch (e) {}
    }

    // 3. For npx vincio / headless / zero-friction setup: Auto-generate 6-digit PIN
    sessionAdminPassword = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ password: sessionAdminPassword, username: adminUsername }, null, 2));
    } catch (e) {}

    bootUpApp();
}

async function getLocalOllamaModels() {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            return data.models.map(m => m.name);
        }
    } catch (err) { return []; }
    return [];
}

function buildFileTree(dir) {
    const result = [];
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (item === '.git' || item === 'node_modules') continue;
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            const relativePath = itemPath.replace(sharedDir + path.sep, '').replace(/\\/g, '/');
            
            if (stat.isDirectory()) {
                result.push({ name: item, type: 'folder', path: relativePath, children: buildFileTree(itemPath) });
            } else {
                result.push({ name: item, type: 'file', path: relativePath });
            }
        }
    } catch(err) {}
    return result;
}

// Expose current user & system info to frontend
app.get('/api/user', (req, res) => {
    res.json({ username: adminUsername });
});

app.get('/api/system-info', (req, res) => {
    const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.hostname === 'localhost';
    res.json({
        username: adminUsername,
        tunnelUrl: currentCloudflareLink,
        platform: os.platform(),
        arch: os.arch(),
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        isLocalHost: isLocal,
        adminPin: isLocal ? sessionAdminPassword : null
    });
});

io.on('connection', (socket) => {
    activeUsers[socket.id] = { 
        id: socket.id, 
        name: `Dev-${guestCounter++}`, 
        title: 'Software Engineer',
        avatar: 'bolt',
        status: 'In the zone',
        github: '',
        role: 'guest' 
    };
    io.emit('user-list', Object.values(activeUsers));
    
    socket.emit('terminal-output', '\r\n[System] Vincio Studio Connected. Type "sync <filename>" to pull local files into the editor.\r\n> ');
    
    // Send active tunnel link to connecting client
    if (currentCloudflareLink && currentCloudflareLink.startsWith('http')) {
        socket.emit('tunnel-url', currentCloudflareLink);
    }

    socket.on('request-local-models', async () => {
        const models = await getLocalOllamaModels();
        socket.emit('local-models-list', models);
    });

    socket.on('update-profile', (profileData) => {
        if (activeUsers[socket.id]) {
            if (typeof profileData === 'string') {
                activeUsers[socket.id].name = profileData;
            } else if (typeof profileData === 'object') {
                activeUsers[socket.id] = {
                    ...activeUsers[socket.id],
                    ...profileData
                };
            }
            io.emit('user-list', Object.values(activeUsers));
        }
    });

    socket.on('group-chat-send', (data) => {
        const senderInfo = activeUsers[socket.id] || { 
            name: 'Unknown', 
            role: 'guest', 
            title: 'Developer', 
            avatar: 'bolt', 
            status: 'Active', 
            github: '' 
        };
        io.emit('group-chat-receive', { 
            id: data.id,
            sender: senderInfo.name, 
            role: senderInfo.role, 
            title: senderInfo.title || 'Developer',
            avatar: senderInfo.avatar || 'bolt',
            status: senderInfo.status || 'Active',
            github: senderInfo.github || '',
            msg: data.msg,
            senderId: socket.id
        });
    });

    // End-to-End Private 1-on-1 Direct Messaging (Only sender and recipient receive this)
    socket.on('private-chat-send', (data) => {
        if (!data || !data.recipientId || !data.msg) return;
        const senderInfo = activeUsers[socket.id] || { 
            name: 'Anonymous', 
            role: 'guest', 
            title: 'Developer', 
            avatar: 'bolt', 
            status: 'Active', 
            github: '' 
        };
        const dmPayload = {
            id: data.id || 'dm-' + Date.now(),
            sender: senderInfo.name,
            role: senderInfo.role,
            title: senderInfo.title || 'Developer',
            avatar: senderInfo.avatar || 'bolt',
            status: senderInfo.status || 'Active',
            github: senderInfo.github || '',
            msg: data.msg,
            senderId: socket.id,
            recipientId: data.recipientId,
            timestamp: new Date().toISOString()
        };

        // Strictly deliver to recipient socket and echo back to sender socket
        io.to(data.recipientId).emit('private-chat-receive', dmPayload);
        socket.emit('private-chat-receive', dmPayload);
    });

    socket.on('edit-msg', (data) => {
        socket.broadcast.emit('msg-edited', data);
    });

    socket.on('delete-msg', (id) => {
        socket.broadcast.emit('msg-deleted', id);
    });

    socket.on('stop-ai', () => {
        activeAiStreams[socket.id] = false;
    });

    socket.on('authenticate', (token, callback) => {
        if (token === sessionAdminPassword) { 
            activeUsers[socket.id].role = 'admin';
            io.emit('user-list', Object.values(activeUsers)); 
            callback({ success: true });
        } else {
            callback({ success: false });
        }
    });

    socket.on('terminal-input', (data) => {
        if (activeUsers[socket.id].role !== 'admin') {
            socket.emit('terminal-output', '\r\n[Error] Access Denied. Admin permissions required.\r\n> ');
            return;
        }

        const strData = data.trim();
        if (strData.startsWith('sync ')) {
            const fileName = strData.replace('sync ', '').trim();
            const filePath = path.join(process.cwd(), fileName);
            
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                io.emit('code-update', fileContent);
                ptyProcess.write(`\r\n[Vincio System] Successfully synced "${fileName}" to live editor.\r\n> `);
                return;
            } else {
                ptyProcess.write(`\r\n[Vincio System] Error: File "${fileName}" not found.\r\n> `);
                return;
            }
        }

        ptyProcess.write(data);
    });

    socket.on('code-update', (code) => socket.broadcast.emit('code-update', code));
    
    socket.on('request-shared-files', () => {
        try { socket.emit('shared-files-tree', buildFileTree(sharedDir)); } catch (e) {}
    });

    socket.on('upload-file', ({ filePath, data }) => {
        const fullPath = path.join(sharedDir, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFile(fullPath, data, (err) => { if (err) console.error("Upload error:", err); });
    });

    socket.on('create-folder', (folderName) => {
        if (!folderName) return;
        const safeName = folderName.replace(/(\.\.[\/\\])+/g, ''); 
        const targetPath = path.join(sharedDir, safeName);
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
            io.emit('shared-files-tree', buildFileTree(sharedDir));
        }
    });

    socket.on('refresh-drive', () => {
        io.emit('shared-files-tree', buildFileTree(sharedDir));
    });

    // Auto-save generated files directly to host project workspace
    socket.on('save-workspace-file', ({ filename, content }, callback) => {
        if (!filename || typeof content !== 'string') return;
        try {
            const safeName = path.basename(filename);
            const targetPath = path.join(process.cwd(), safeName);
            fs.writeFileSync(targetPath, content, 'utf8');
            console.log(`[Workspace Auto-Write] Saved ${safeName} (${content.length} bytes) to disk`);
            if (callback) callback({ success: true, filename: safeName, path: targetPath });
            io.emit('workspace-file-saved', { filename: safeName });
        } catch (err) {
            console.error(`[Workspace Auto-Write Error] ${filename}:`, err.message);
            if (callback) callback({ success: false, error: err.message });
        }
    });

    // Execute script file directly in live terminal process
    socket.on('execute-terminal-file', ({ filename }) => {
        if (!filename) return;
        const safeName = path.basename(filename);
        const ext = safeName.split('.').pop().toLowerCase();
        let cmd = '';
        if (ext === 'py') cmd = `python3 ${safeName}\n`;
        else if (ext === 'js') cmd = `node ${safeName}\n`;
        else if (ext === 'sh') cmd = `bash ${safeName}\n`;
        else if (ext === 'html') cmd = `echo "File saved: ${safeName}. Available in workspace"\n`;
        else cmd = `./${safeName}\n`;
        
        if (cmd && ptyProcess) {
            ptyProcess.write(cmd);
        }
    });

    socket.on('ai-prompt', async ({ prompt, modelSelection, customModels, apiKeys = {}, codeContext }) => {
        activeAiStreams[socket.id] = true;
        let queue = [];
        const localModels = await getLocalOllamaModels();
        
        if (!modelSelection || modelSelection === 'omnirouter' || modelSelection === 'team_chat') {
            Object.keys(customModels || {}).forEach(name => {
                queue.push({ type: 'custom', name: name, baseUrl: customModels[name].url, apiKey: customModels[name].key || 'custom' });
            });
            if (apiKeys.deepseek) queue.push({ type: 'cloud', name: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', apiKey: apiKeys.deepseek });
            if (apiKeys.openai) queue.push({ type: 'cloud', name: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', apiKey: apiKeys.openai });
            if (apiKeys.groq) queue.push({ type: 'cloud', name: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1', apiKey: apiKeys.groq });
            if (apiKeys.gemini) queue.push({ type: 'cloud', name: 'gemini-2.0-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: apiKeys.gemini });
            if (apiKeys.openrouter) queue.push({ type: 'cloud', name: 'anthropic/claude-3.5-sonnet', baseUrl: 'https://openrouter.ai/api/v1', apiKey: apiKeys.openrouter });

            localModels.forEach(name => {
                queue.push({ type: 'local', name: name, baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'local' });
            });

            if (queue.length === 0) {
                socket.emit('ai-response', '💡 **No AI Model Available**\n\nTo use Vincio AI Studio:\n1. Ensure Ollama is running (`ollama run qwen2.5-coder:1.5b`)\n2. Or select a model and configure an API key (DeepSeek, OpenAI, Groq, OpenRouter) via the bottom **Model Selector**.');
                socket.emit('ai-done');
                return;
            }
        } else if (modelSelection.startsWith('local:')) {
            const name = modelSelection.replace('local:', '');
            queue.push({ type: 'local', name: name, baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'local' });
        } else if (modelSelection.startsWith('cloud:')) {
            const parts = modelSelection.split(':');
            const provider = parts[1];
            const modelName = parts.slice(2).join(':');

            const keyMap = {
                deepseek: { key: apiKeys.deepseek || process.env.DEEPSEEK_API_KEY, url: 'https://api.deepseek.com', name: 'DeepSeek' },
                openai: { key: apiKeys.openai || process.env.OPENAI_API_KEY, url: 'https://api.openai.com/v1', name: 'OpenAI' },
                groq: { key: apiKeys.groq || process.env.GROQ_API_KEY, url: 'https://api.groq.com/openai/v1', name: 'Groq' },
                gemini: { key: apiKeys.gemini || process.env.GEMINI_API_KEY, url: 'https://generativelanguage.googleapis.com/v1beta/openai/', name: 'Google Gemini' },
                openrouter: { key: apiKeys.openrouter || process.env.OPENROUTER_API_KEY, url: 'https://openrouter.ai/api/v1', name: 'OpenRouter' }
            };

            const provCfg = keyMap[provider];
            if (provCfg) {
                if (!provCfg.key) {
                    socket.emit('ai-response', `⚠️ **${provCfg.name} API Key Missing**\n\nPlease add your API key by opening the bottom **Model Selector** -> **⚙️ API Keys & Models**.\n*(Stored locally in your browser).*`);
                    socket.emit('ai-done');
                    return;
                }
                queue.push({ type: 'cloud', name: modelName, baseUrl: provCfg.url, apiKey: provCfg.key });
            } else {
                queue.push({ type: 'cloud', name: modelName, baseUrl: 'https://openrouter.ai/api/v1', apiKey: apiKeys.openrouter || 'missing' });
            }
        } else if (modelSelection.startsWith('custom:')) {
            const name = modelSelection.replace('custom:', '');
            if (customModels && customModels[name]) {
                queue.push({ type: 'custom', name: name, baseUrl: customModels[name].url, apiKey: customModels[name].key || 'custom' });
            }
        }

        if (queue.length === 0) {
            socket.emit('ai-response', '⚠️ The selected model could not be found or loaded.');
            socket.emit('ai-done');
            return;
        }

        let success = false;
        let lastErr = '';
        for (let i = 0; i < queue.length; i++) {
            if (!activeAiStreams[socket.id]) break;

            const target = queue[i];
            socket.emit('omnirouter-status', `⚡ Streaming via [${target.name}]`);
            socket.emit('ai-active-model', { name: target.name, type: target.type });
            
            const client = new OpenAI({ baseURL: target.baseUrl, apiKey: target.apiKey, timeout: 60000 });
            
            try {
                const stream = await client.chat.completions.create({
                    model: target.name,
                    messages: [
                        { role: 'system', content: `You are Vincio AI, an autonomous software architect and developer.
When the user asks you to build, create, refactor, or fix code or a project:
1. ALWAYS clearly label each file above its code block using this exact markdown header:
   ### filename.ext
   \`\`\`language
   // Complete code here
   \`\`\`
2. Write full, production-ready, working code. Never skip lines or use placeholder comments.
3. If dependencies or a terminal execution command is needed, provide a separate bash block:
   \`\`\`bash
   python3 filename.py
   \`\`\`
Context code:
${codeContext || ''}` },
                        { role: 'user', content: prompt }
                    ],
                    stream: true
                });
                let chunkReceived = false;
                for await (const chunk of stream) {
                    if (!activeAiStreams[socket.id]) {
                        socket.emit('ai-response', '\n\n*(Generation stopped)*');
                        break;
                    }
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        chunkReceived = true;
                        socket.emit('ai-response', content);
                    }
                }
                if (chunkReceived) {
                    success = true;
                    socket.emit('ai-done');
                    break; 
                }
            } catch (err) {
                console.error(`[AI Error] [${target.name}] Failed:`, err.message);
                lastErr = err.message;
                socket.emit('omnirouter-status', `⚠️ [${target.name}] failed: ${err.message}. Trying next fallback...`);
            }
        }
        if (!success && activeAiStreams[socket.id]) {
            socket.emit('ai-response', `\n\n❌ **Execution Error:** ${lastErr || 'Model connection failed'}.\n*Please verify that Ollama is running locally (\`ollama serve\`) or check your API key.*`);
            socket.emit('ai-done');
        }
    });

    socket.on('disconnect', () => {
        delete activeUsers[socket.id];
        delete activeAiStreams[socket.id];
        io.emit('user-list', Object.values(activeUsers));
    });
});

chokidar.watch(process.cwd(), { ignored: /node_modules|\.git|vincio_shared|\.DS_Store/ }).on('change', (filePath) => {
    try {
        if (filePath.endsWith('.js') || filePath.endsWith('.py') || filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf8');
            io.emit('code-update', content);
        }
    } catch(e) {}
});

ptyProcess.onData((data) => {
    io.emit('terminal-output', data);
});

const PORT = process.env.PORT || 8000;

function bootUpApp() {
    server.listen(PORT, () => {
        console.log(`
┌────────────────────────────────────────────────────────┐
│                   🚀  VINCIO STUDIO                    │
├────────────────────────────────────────────────────────┤
│  Local URL:    http://localhost:${PORT}                    │
│  Admin PIN:    \x1b[32m\x1b[1m${sessionAdminPassword}\x1b[0m (Use to unlock terminal)       │
│  Admin User:   ${adminUsername}
│  Workspace:    ${process.cwd()}
└────────────────────────────────────────────────────────┘
        `);
        
        try {
            const cloudflare = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`]);
            cloudflare.stderr.on('data', (data) => {
                const str = data.toString();
                const matches = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
                if (matches) {
                    const validTunnel = matches.find(url => !url.includes('api.trycloudflare.com'));
                    if (validTunnel) {
                        currentCloudflareLink = validTunnel;
                        io.emit('tunnel-url', currentCloudflareLink);
                        console.log(`[AUTO-HOST] Public Link: ${currentCloudflareLink}\n`);
                    }
                }
            });
            cloudflare.on('error', () => {
                console.log(`[NOTICE] Cloudflare tunnel skipped (cloudflared not installed). Running locally.`);
            });
        } catch (e) {
            console.log(`[NOTICE] Cloudflare tunnel skipped.`);
        }
    });
}

initServerStartup();
