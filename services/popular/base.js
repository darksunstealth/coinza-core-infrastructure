import Redis from './cache/redis.js';
import fs from "fs";
import { performance } from "perf_hooks";

const redis = new Redis();
async function InitializeVariablesOnRedis(key, filePath) {
    console.log(`[${new Date().toISOString()}] 🔹 Iniciando processamento de ${key}`);

    const startTime = performance.now();

    try {
        console.log(`[${new Date().toISOString()}] 📂 Lendo arquivo: ${filePath}`);
        const data = fs.readFileSync(filePath, "utf-8");
        const jsonData = JSON.parse(data);

        console.log(`[${new Date().toISOString()}] ⚡ Enviando dados para o Redis usando HSET [${key}]`);

        for (const field in jsonData) {
            await redis.redisClient.hset(key, field, JSON.stringify(jsonData[field]));
        }

        const endTime = performance.now();
        console.log(`[${new Date().toISOString()}] ✅ Sucesso ao armazenar ${key} no Redis (Tempo: ${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ ERRO ao processar ${key}:`, error);
    }
}

const jsonFiles = {
    "ASSETS_ALL": "./base/assets.json",
    "NETWORK_ALL": "./base/networks.json",
    "MARKET_ALL": "./base/markets.json"
};

async function initAll() {
    console.log(`[${new Date().toISOString()}] 🚀 Iniciando inicialização de variáveis no Redis...`);

    for (const [key, filePath] of Object.entries(jsonFiles)) {
        console.log(`[${new Date().toISOString()}] 🔍 Processando: ${key}`);
        await InitializeVariablesOnRedis(key, filePath);
    }

    console.log(`[${new Date().toISOString()}] 🛑 Finalizando conexão com Redis...`);
    redis.redisClient.disconnect();
    console.log(`[${new Date().toISOString()}] ✅ Conexão com Redis encerrada.`);
}

initAll();
