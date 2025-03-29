export default class WalletController {
    constructor(redis, lrucache) {
      this.redis = redis;       // Instância do Redis (por exemplo, RedisService)
      this.lrucache = lrucache;   // Instância de cache (se necessário)
    }
  
    /**
     * Busca os saldos da carteira (balances) de um usuário.
     * @param {string} userId - Identificador do usuário.
     * @returns {Object|null} - Objeto com os saldos ou null se não encontrar.
     */
    async getWalletBalances(userId) {
      try {
        const redisKey = `USER:${userId}`;
        
        // Verifica se o campo 'balances' existe na hash do usuário
        const exists = await this.redis.hexists(redisKey, 'balances');
        if (!exists) {
          console.log(`Carteira do usuário ${userId} não encontrada.`);
          return null;
        }
        
        // Recupera o campo 'balances'
        const balanceStr = await this.redis.hget(redisKey, 'balances');
        if (!balanceStr) {
          console.log(`Saldo não encontrado para o usuário ${userId}.`);
          return null;
        }
        
        // Converte a string JSON para objeto
        const balances = JSON.parse(balanceStr);
        
        console.log(`Saldos do usuário ${userId}:`);
        Object.keys(balances).forEach((moeda) => {
          console.log(`${moeda}: ${balances[moeda]}`);
        });
        
        return balances;
      } catch (error) {
        console.error('Erro ao obter os saldos da carteira:', error);
        throw error;
      }
    }
  }
  