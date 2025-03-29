import Redis from './cache/redis.js';
import fs from "fs";
import { performance } from "perf_hooks";

const redis = new Redis();

function sanitizeData(data) {
  if (data === null || data === undefined) {
    return "";
  }
  if (typeof data === "object") {
    return JSON.stringify(data);
  }
  return data;
}

// Definição da função InitializeUserAdmin
async function InitializeUserAdmin() {
  const userKey = "user:admin";
  const filePath = "./user/user.json";

  console.log(`[${new Date().toISOString()}] 🔹 Iniciando processamento de ${userKey}`);

  const startTime = performance.now();

  try {
    console.log(`[${new Date().toISOString()}] 📂 Lendo arquivo: ${filePath}`);
    const data = fs.readFileSync(filePath, "utf-8");
    const jsonData = JSON.parse(data);

    console.log(`[${new Date().toISOString()}] ⚡ Salvando dados no Redis via HSET [${userKey}]`);
    
    for (const field in jsonData) {
      await redis.redisClient.hset(userKey, field, sanitizeData(jsonData[field]));
    }

    console.log(`[${new Date().toISOString()}] ⚡ Atualizando índice de usuários (SET "users")`);
    await redis.redisClient.set("users", JSON.stringify({ id: jsonData.id, email: jsonData.email }));

    const endTime = performance.now();
    console.log(
      `[${new Date().toISOString()}] ✅ Sucesso ao armazenar ${userKey} no Redis (Tempo: ${(endTime - startTime).toFixed(2)}ms)`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ ERRO ao processar ${userKey}:`, error);
  }
}

async function InitializeMarkets() {
  const filePath = "./base/markets.json";
  console.log(`[${new Date().toISOString()}] 🔹 Iniciando processamento de MARKETS_ALL`);
  const startTime = performance.now();
  
  try {
    console.log(`[${new Date().toISOString()}] 📂 Lendo arquivo: ${filePath}`);
    const data = fs.readFileSync(filePath, "utf-8");
    const markets = JSON.parse(data); // Espera-se um array de mercados

    // Limpa o hash "MARKETS_ALL" caso já exista (opcional)
    await redis.redisClient.del("MARKETS_ALL");

    // Processa cada mercado
    for (let index = 0; index < markets.length; index++) {
      const market = markets[index];

      // Se necessário, também pode armazenar cada mercado separadamente via HSET
      const marketKey = `MARKET:${market.id}`;
      for (const field in market) {
        await redis.redisClient.hset(marketKey, field, sanitizeData(market[field]));
      }
    }

    const endTime = performance.now();
    console.log(
      `[${new Date().toISOString()}] ✅ Sucesso ao armazenar mercados no Redis (Tempo: ${(endTime - startTime).toFixed(2)}ms)`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ ERRO ao processar mercados:`, error);
  }
}

// Suponha que InitializeMarkets e InitializeGeneric já estejam definidos aqui...

async function InitializeVariablesOnRedis() {
  console.log(`[${new Date().toISOString()}] 🚀 Iniciando inicialização de variáveis no Redis...`);

  const jsonFiles = {
    "ASSETS_ALL": "./base/assets.json",
    "NETWORK_ALL": "./base/networks.json"
  };

  async function InitializeGeneric(key, filePath) {
    console.log(`[${new Date().toISOString()}] 🔹 Iniciando processamento de ${key}`);
    const startTime = performance.now();
    try {
      console.log(`[${new Date().toISOString()}] 📂 Lendo arquivo: ${filePath}`);
      const data = fs.readFileSync(filePath, "utf-8");
      const jsonData = JSON.parse(data);

      console.log(`[${new Date().toISOString()}] ⚡ Enviando dados para o Redis usando HSET [${key}]`);
      for (const field in jsonData) {
        await redis.redisClient.hset(key, field, sanitizeData(jsonData[field]));
      }

      const endTime = performance.now();
      console.log(`[${new Date().toISOString()}] ✅ Sucesso ao armazenar ${key} no Redis (Tempo: ${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) { 
      console.error(`[${new Date().toISOString()}] ❌ ERRO ao processar ${key}:`, error);
    }
  }

  // Processa os demais arquivos
  for (const [key, filePath] of Object.entries(jsonFiles)) {
    console.log(`[${new Date().toISOString()}] 🔍 Processando: ${key}`);
    await InitializeGeneric(key, filePath);
  }

  // Processa os mercados de forma especial
  await InitializeMarkets();

  // Processa o usuário admin
  await InitializeUserAdmin();

  console.log(`[${new Date().toISOString()}] 🛑 Finalizando conexão com Redis...`);
  redis.redisClient.disconnect();
  console.log(`[${new Date().toISOString()}] ✅ Conexão com Redis encerrada.`);
}

InitializeVariablesOnRedis();
