const Redis = require('ioredis');

(async function testXadd() {
  try {
    // Ajuste seus nós aqui
    const redisNodesEnv = process.env.REDIS_NODES 
      || 'redis-cluster-0.redis-cluster.default.svc.cluster.local:6379';
    const redisNodes = redisNodesEnv.split(',').map(node => {
      const [host, port] = node.split(':');
      return { host: host.trim(), port: Number(port.trim()) };
    });

    const cluster = new Redis.Cluster(redisNodes, {
      scaleReads: 'slave',
      redisOptions: {
        retryStrategy: (times) => Math.min(times * 100, 3000),
        connectTimeout: 30000,
        maxRetriesPerRequest: 100
      },
    });

    cluster.on('error', err => {
      console.error('[TEST] Redis client error:', err);
    });
    cluster.on('nodeError', err => {
      console.error('[TEST] Redis node error:', err);
    });

    const ping = await cluster.ping();
    console.log('PING result:', ping);  // Espera "PONG"

    // Tente xadd
    console.log('Tentando XADD...');
    const res = await cluster.xadd('orderStream', '*', 'orders', 'teste-isolado');
    console.log('XADD retornou:', res);

    process.exit(0);
  } catch (e) {
    console.error('[TEST] Erro durante XADD:', e);
    process.exit(1);
  }
})();
