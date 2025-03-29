import { v4 as uuidv4 } from "uuid";

class WalletService {
  constructor(cachemanager, logger) {
    this.logger = logger;
this.cachemanager = cachemanager
    if (!this.cachemanager) {
      throw new Error("RedisCacheManager não está disponível");
    }
  }
  async linkWalletToUser(userId, transaction = null) {
    const functionName = '[LINKWALLETTOSUSER]';
    this.logger.debug(`${functionName} Iniciando a vinculação de carteiras para o usuário: ${userId}`, { userId });
  
    try {
      if (!transaction) {
        throw new Error('Transação não fornecida para vinculação de carteiras.');
      }
  
      const redes = await this.models.Networks.findAll({ transaction });
      if (!redes || redes.length === 0) {
        throw new Error('Nenhuma rede encontrada para vincular carteiras.');
      }
  
      const carteirasVinculadas = [];
      for (const rede of redes) {
        const carteiraDisponivel = await this.models.Wallets.findOne({
          where: { vinculada: false, networkId: rede.id },
          transaction,
          lock: transaction.LOCK.UPDATE, // Certifique-se de que o LOCK está configurado corretamente
        });
  
        if (!carteiraDisponivel) {
          continue;
        }
  
        carteiraDisponivel.vinculada = true;
        carteiraDisponivel.userId = userId;
        await carteiraDisponivel.save({ transaction });
  
        carteirasVinculadas.push({
          networkId: rede.id,
          walletId: carteiraDisponivel.id,
          endereco: carteiraDisponivel.endereco,
        });
      }
  
      this.logger.info(`${functionName} Carteiras vinculadas com sucesso ao usuário ${userId}.`, { carteirasVinculadas });
  
      return { carteirasVinculadas };
    } catch (error) {
      this.logger.error(`${functionName} Erro ao vincular carteiras: ${error.message}`, { error });
      throw error;
    }
  }
  
}



export default WalletService;