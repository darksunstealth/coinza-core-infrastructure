
import Redis from 'ioredis';

export class RedisCacheManager {
  constructor() {
    console.log(`[${new Date().toISOString()}] 🚀 Inicializando RedisCacheManager...`);

    // Obtém o endereço do Redis da variável de ambiente ou usa 'localhost:6379' como fallback
    const redisHostPort = process.env.REDIS_HOST || 'localhost:6379';

    console.log(`[${new Date().toISOString()}] 🔍 Conectando ao Redis em:`, redisHostPort);

    // Extrai host e porta da string
    const [host, port] = redisHostPort.split(':');

    // Configura a conexão com Redis Standalone
    this.redisClient = new Redis({
      host: host.trim(),
      port: Number(port.trim()),
      retryStrategy: (times) => Math.min(times * 100, 3000), // Estratégia de reconexão
      maxRetriesPerRequest: 3, // Número máximo de tentativas por requisição
      connectTimeout: 30000, // Timeout de conexão em milissegundos
    });

    // Eventos de conexão para depuração
    this.redisClient.on('connect', () => {
      console.log(`[${new Date().toISOString()}] ✅ Conectado ao Redis!`);
    });

    this.redisClient.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] ❌ Erro no Redis:`, error);
    });
  }
}

export default RedisCacheManager;
