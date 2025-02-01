// server-worker.js
import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from 'redis'; // Exemplo
import { v4 as uuid } from 'uuid';
import pino from 'pino';

import OrderBook from './OrderBook.js';
import { SnowflakeIdGenerator } from './utils/snowflake.js'; 
// ^-- Supondo que você tenha alguma implementação do SnowflakeIdGenerator

export async function createServerApp() {
  const app = express();
  app.use(bodyParser.json());

  // Exemplo de logger
  const logger = pino({ level: 'info' });

  // Exemplo de conexão Redis
  const redisClient = createClient({
    url: 'redis://localhost:6379'
  });
  redisClient.on('error', (err) => logger.error('Redis Error:', err));
  await redisClient.connect();

  // Montamos um "redisOptions" para passar ao OrderBook
  const redisOptions = {
    redisClient
  };

  // Instanciamos nosso OrderBook
  const orderBook = new OrderBook(app, redisOptions, logger, SnowflakeIdGenerator);

  // Exemplo de rota para receber novas ordens (HTTP)
  app.post('/orders', async (req, res) => {
    try {
      const orderData = req.body;
      // Aqui você pode fazer qualquer pré-validação
      const validated = orderBook.validatedOrder(orderData);
      const result = await orderBook.addOrder(validated);
      res.json({ success: true, order: result });
    } catch (err) {
      logger.error('Erro ao adicionar ordem:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Outras rotas, métricas já estão em /metrics no próprio OrderBook
  // ...

  // Sobe o servidor (cada worker escuta numa mesma porta, mas o cluster gerencia)
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    logger.info(`Worker process ${process.pid} escutando em http://localhost:${PORT}`);
  });

  return { app, server };
}
