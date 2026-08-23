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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e7 });

const sharedDir = path.join(process.cwd(), 'vincio_shared');
if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir);
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
let sessionAdminPassword = "ADMIN_PASSWORD";

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
    return result;
}

io.on('connection', (socket) => {
    activeUsers[socket.id] = { id: socket.id, name: `Guest-${guestCounter++}`, role: 'guest' };
    io.emit('user-list', Object.values(activeUsers));
    
    socket.emit('terminal-output', '\r\n[System] Vincio Environment Connected. Type "sync <filename>" to pull any file into the workspace.\r\n> ');

    socket.on('request-local-models', async () => {
        const models = await getLocalOllamaModels();
        socket.emit('local-models-list', models);
    });

    socket.on('update-profile', (newName) => {
        if (activeUsers[socket.id]) {
            activeUsers[socket.id].name = newName;
            io.emit('user-list', Object.values(activeUsers));
        }
    });

    socket.on('group-chat-send', (data) => {
        const senderInfo = activeUsers[socket.id] || { name: 'Unknown', role: 'guest' };
        io.emit('group-chat-receive', { 
            id: data.id,
            sender: senderInfo.name, 
            role: senderInfo.role, 
            msg: data.msg,
            senderId: socket.id
        });
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
            activeUsers[socket.id].name = 'Vinyas (Admin)';
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

    socket.on('ai-prompt', async ({ prompt, modelSelection, customModels, codeContext }) => {
        activeAiStreams[socket.id] = true;
        let queue = [];
        
        if (modelSelection === 'omnirouter') {
            Object.keys(customModels).forEach(name => {
                queue.push({ type: 'custom', name: name, baseUrl: customModels[name].url, apiKey: customModels[name].key });
            });
            const localModels = await getLocalOllamaModels();
            localModels.forEach(name => {
                queue.push({ type: 'local', name: name, baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'local' });
            });
            if (queue.length === 0) return socket.emit('ai-response', '❌ No models configured.');
        } else if (modelSelection.startsWith('local:')) {
            const name = modelSelection.replace('local:', '');
            queue.push({ type: 'local', name: name, baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'local' });
        } else if (modelSelection.startsWith('custom:')) {
            const name = modelSelection.replace('custom:', '');
            queue.push({ type: 'custom', name: name, baseUrl: customModels[name].url, apiKey: customModels[name].key });
        }

        let success = false;
        for (let i = 0; i < queue.length; i++) {
            if (!activeAiStreams[socket.id]) break;

            const target = queue[i];
            socket.emit('omnirouter-status', `⚡ Processing via [${target.name}]`);
            const client = new OpenAI({ baseURL: target.baseUrl, apiKey: target.apiKey, timeout: 5000 });
            
            try {
                const stream = await client.chat.completions.create({
                    model: target.name,
                    messages: [
                        { role: 'system', content: `Context: ${codeContext}` },
                        { role: 'user', content: prompt }
                    ],
                    stream: true
                });
                let chunkReceived = false;
                for await (const chunk of stream) {
                    if (!activeAiStreams[socket.id]) {
                        socket.emit('ai-response', '\n\n[🛑 Generation Paused]');
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
                socket.emit('omnirouter-status', `⚠️ [${target.name}] Failed: ${err.message}. Trying next...`);
            }
        }
        if (!success && activeAiStreams[socket.id]) socket.emit('ai-response', `\r\n❌ All models failed.`);
    });

    socket.on('disconnect', () => {
        delete activeUsers[socket.id];
        delete activeAiStreams[socket.id];
        io.emit('user-list', Object.values(activeUsers));
    });
});

// Automatic background file watcher to sync saved changes instantly
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

const PORT = 8000;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\n🔒 Create an Admin Password for this Vincio session: ', (answer) => {
    if (answer.trim()) sessionAdminPassword = answer.trim();
    console.log(`\n✅ Password set successfully!`);
    
    server.listen(PORT, () => {
        console.log(`Vincio live at http://localhost:${PORT}`);
        const cloudflare = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`]);
        cloudflare.stderr.on('data', (data) => {
            const match = data.toString().match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match) {
                currentCloudflareLink = match[0];
                console.log(`[AUTO-HOST] Public Link: ${currentCloudflareLink}\n`);
            }
        });
    });
});
