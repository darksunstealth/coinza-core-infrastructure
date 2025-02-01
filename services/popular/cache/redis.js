import Redis from 'ioredis';

export class RedisCacheManager {
  constructor() {
    console.log(`[${new Date().toISOString()}] 🚀 Inicializando RedisCacheManager...`);

    // Obtém nós do Redis Cluster da variável de ambiente ou usa um fallback
    const redisNodesEnv = process.env.REDIS_NODES 
      || 'redis-cluster-0.redis-cluster.redis-cluster.svc.cluster.local:6379,redis-cluster-1.redis-cluster.redis-cluster.svc.cluster.local:6379,redis-cluster-2.redis-cluster.redis-cluster.svc.cluster.local:6379';

    console.log(`[${new Date().toISOString()}] 🔍 Usando nós Redis:`, redisNodesEnv);

    // Converte a string de nós em um array de objetos [{host, port}, ...]
    const redisNodes = redisNodesEnv.split(',').map(node => {
      const [host, port] = node.split(':');
      return { host: host.trim(), port: Number(port.trim()) };
    });

    console.log(`[${new Date().toISOString()}] 🛠️ Configurando cluster Redis com os nós:`, redisNodes);

    // Configura a conexão com o Redis Cluster
    this.redisClient = new Redis.Cluster(redisNodes, {
      scaleReads: 'master', // Garante que lê e escreve apenas nos mestres
      redisOptions: {
        retryStrategy: (times) => Math.min(times * 100, 3000), // Estratégia de reconexão
        maxRetriesPerRequest: 3, // Número máximo de tentativas por requisição
        connectTimeout: 30000, // Timeout de conexão em milissegundos
      },
    });

    // Eventos de conexão para depuração
    this.redisClient.on('connect', () => {
      console.log(`[${new Date().toISOString()}] ✅ Conectado ao Redis Cluster!`);
    });

    this.redisClient.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] ❌ Erro no Redis Cluster:`, error);
    });
  }

}

export default RedisCacheManager;
