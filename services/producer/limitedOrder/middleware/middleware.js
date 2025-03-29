import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const secretKey = process.env.JWT_SECRET;

class AuthenticationMiddleware {
  constructor(logger, redisCacheManager, cacheManager) {
    this.logger = logger;
    this.jwt = jwt;
    this.redisCacheManager = redisCacheManager;
    this.cacheManager = cacheManager;
    this.secretKey = secretKey;

    this.redisSessionTimeout = 7 * 24 * 60 * 60; // 7 dias
    this.localCacheTimeout = 10 * 60; // 10 minutos (em segundos)

    // Propriedade para ativar ou desativar a autenticação.
    // Se status for false, a autenticação será ignorada.
    this.status = false;
  }

  async check(req, res, next) {
    // Se a autenticação estiver desabilitada, pula para a próxima função de middleware.
    if (!this.status) {
      this.logger.info('Autenticação desabilitada. Pulando validação.');
      req.user = { id: 'default-user', email: null };
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!token && (!apiKey || !apiSecret)) {
      this.logger.warn('Requisição recusada. Credenciais não fornecidas.');
      return res.status(401).json({ error: 'Credenciais não fornecidas.' });
    }

    try {
      let userId;
      let email = null;

      // Autenticação via Token JWT
      if (token) {
        const decoded = this.jwt.verify(token, this.secretKey);
        userId = decoded.id;
        email = decoded.email;
      }

      // Autenticação via API Key e Secret
      if (apiKey && apiSecret) {
        // Primeiro, tente obter a API key do cache local
        let apiKeyData = await this.cacheManager.get(`ApiKey:${apiKey}`);
        this.logger.debug(`Tentativa de recuperar API Key ${apiKey} do cache local.`);

        // Caso não esteja disponível no cache local, busque no Redis
        if (!apiKeyData) {
          this.logger.info(`API Key ${apiKey} não encontrada no cache local. Buscando no Redis...`);
          // Use hgetall para obter uma hash, já que a chave foi criada com HSET
          apiKeyData = await this.redisCacheManager.redisClient.hgetall(`ApiKey:${apiKey}`);

          // Log de depuração detalhado do resultado do Redis
          if (apiKeyData && Object.keys(apiKeyData).length > 0) {
            this.logger.debug(`API Key ${apiKey} encontrada no Redis: ${JSON.stringify(apiKeyData)}`);
          } else {
            this.logger.warn(`API Key ${apiKey} não encontrada no Redis.`);
          }

          // Salve os dados no cache local com TTL de 10 minutos
          if (apiKeyData && Object.keys(apiKeyData).length > 0) {
            await this.cacheManager.set(`ApiKey:${apiKey}`, apiKeyData, { ttl: this.localCacheTimeout });
            this.logger.info(`API Key ${apiKey} armazenada no cache local após fallback ao Redis.`);
          } else {
            return res.status(401).json({ error: 'Chave de API inválida.' });
          }
        } else {
          this.logger.debug(`API Key ${apiKey} encontrada no cache local.`);
        }

        // Verifique a validade do secret
        const isValidSecret = await bcrypt.compare(apiSecret, apiKeyData.apiSecretKey);
        if (!isValidSecret) {
          this.logger.warn('Chave secreta de API inválida.');
          return res.status(401).json({ error: 'Chave de API inválida.' });
        }

        userId = apiKeyData.userId;
        email = apiKeyData.email || email;
      }

      req.user = { id: userId, email };

      return next();
    } catch (error) {
      this.logger.error(`Erro ao autenticar: ${error.message}`);
      if (error instanceof this.jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token expirado.' });
      }
      if (error instanceof this.jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Token inválido.' });
      }
      return res.status(401).json({ error: 'Credenciais inválidas ou sessão encerrada.' });
    }
  }
}

export default AuthenticationMiddleware;
