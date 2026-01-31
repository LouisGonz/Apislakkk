const express = require('express');
const fs = require('fs').promises; // Para operações de arquivo mais eficientes
const path = require('path');
const axios = require('axios'); // Necessário para a consulta de CEP
const { exec } = require('child_process'); // Necessário para rodar o yt-dlp

const app = express();
const port = 3000;

// Configurações de caminhos
const KEYS_PATH = path.join(__dirname, 'apiKeys.json');
const FRASES_PATH = path.join(__dirname, 'frases.json');

// Servir arquivos estáticos (HTML/CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Helper para ler arquivos JSON
async function readJson(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

// Helper para salvar arquivos JSON
async function saveJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// --- Middleware de Verificação de Chave ---
app.use(async (req, res, next) => {
    const key = req.query.key;
    if (!key) return res.status(401).json({ message: 'Chave da API não fornecida.' });

    try {
        const apiKeys = await readJson(KEYS_PATH);
        if (apiKeys[key]) {
            if (apiKeys[key].used < apiKeys[key].limit) {
                req.apiKey = key;
                req.allKeys = apiKeys; // Passa os dados para as rotas
                next();
            } else {
                res.status(403).json({ message: 'Limite de uso excedido para esta chave.' });
            }
        } else {
            res.status(401).json({ message: 'Chave da API inválida.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao validar chave.' });
    }
});

// --- Rota Principal ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Rota de Frases ---
app.get('/frases', async (req, res) => {
    try {
        const data = await readJson(FRASES_PATH);
        const frases = data.frases;
        const frase = frases[Math.floor(Math.random() * frases.length)];

        // Atualiza contador
        req.allKeys[req.apiKey].used += 1;
        await saveJson(KEYS_PATH, req.allKeys);

        res.json({ frase });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar frase.' });
    }
});

// --- Rota de Consulta CEP ---
app.get('/consulta/:cep', async (req, res) => {
    const { cep } = req.params;
    try {
        const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        
        req.allKeys[req.apiKey].used += 1;
        await saveJson(KEYS_PATH, req.allKeys);

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar o CEP.' });
    }
});

// --- Rota de Download YouTube (yt-dlp) ---
app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL do vídeo é necessária.' });

    // Comando para obter a URL direta do vídeo (MP4)
    const command = `yt-dlp -g -f "best[ext=mp4]" "${videoUrl}"`;

    exec(command, async (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: 'Erro ao processar vídeo.', details: stderr });
        }

        const directLink = stdout.trim();
        
        req.allKeys[req.apiKey].used += 1;
        await saveJson(KEYS_PATH, req.allKeys);

        res.json({
            status: true,
            link: directLink
        });
    });
});

// --- Rota de Status da Chave ---
app.get('/uso', (req, res) => {
    const keyData = req.allKeys[req.apiKey];
    res.json({
        used: keyData.used,
        limit: keyData.limit,
        remaining: keyData.limit - keyData.used
    });
});

app.listen(port, () => {
    console.log(`API Eleven rodando em http://localhost:${port}`);
});
