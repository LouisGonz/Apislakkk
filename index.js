const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Caminhos
const KEYS_PATH = path.join(__dirname, 'apiKeys.json');
const FRASES_PATH = path.join(__dirname, 'frases.json');

// Middleware de Key
app.use(async (req, res, next) => {
    if (req.path === '/' || req.path.includes('.')) return next();
    
    const key = req.query.key;
    try {
        const keys = JSON.parse(await fs.readFile(KEYS_PATH, 'utf8'));
        if (keys[key] && keys[key].used < keys[key].limit) {
            req.apiKey = key;
            req.dbKeys = keys;
            next();
        } else {
            res.status(401).json({ error: 'Key inválida ou limite atingido.' });
        }
    } catch (e) { next(); }
});

// Rotas
app.get('/frases', async (req, res) => {
    const data = JSON.parse(await fs.readFile(FRASES_PATH, 'utf8'));
    const frase = data.frases[Math.floor(Math.random() * data.frases.length)];
    
    req.dbKeys[req.apiKey].used += 1;
    await fs.writeFile(KEYS_PATH, JSON.stringify(req.dbKeys, null, 2));
    res.json({ status: true, frase });
});

app.get('/download', (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL ausente' });

    exec(`yt-dlp -g -f "best[ext=mp4]" "${url}"`, async (err, stdout) => {
        if (err) return res.status(500).json({ error: 'Erro no yt-dlp' });
        
        req.dbKeys[req.apiKey].used += 1;
        await fs.writeFile(KEYS_PATH, JSON.stringify(req.dbKeys, null, 2));
        res.json({ status: true, link: stdout.trim() });
    });
});

app.get('/uso', (req, res) => {
    res.json(req.dbKeys[req.apiKey]);
});

app.listen(port, () => console.log(`Sr. Eleven, API online na porta ${port}`));
