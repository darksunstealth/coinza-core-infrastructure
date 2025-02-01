import express from "express";
import compression from "compression";
import logger from "./logger/logger.js";
import OrderBook from "./orderbook/orderbook.js";
import SnowflakeIdGenerator from "./orderbook/utils/snowflake.js";
import KafkaService from './kafka/kafkaService.js';

const app = express();
app.use(compression());
app.use(express.json());

// Configurações do Kafka
const kafkaBrokers = [process.env.KAFKA_BROKER || '127.0.0.1:32092'];
// Use um clientId único para cada worker
const clientId = `orderbook-producer-${process.pid}`;

const kafkaService = new KafkaService(kafkaBrokers, clientId, {
  linger: 10,
  batchSize: 1048576,
  compression: 'gzip',
});

// Inicializa o KafkaService antes de instanciar os demais serviços
kafkaService.initialize()
  .then(() => {
    logger.info('KafkaService inicializado com sucesso');

    // Cria a instância do SnowflakeIdGenerator
    const snowFlake = new SnowflakeIdGenerator(1, 1);

    // Injeta o KafkaService no OrderBook
    const orderBook = new OrderBook(app, logger, kafkaService);

    // Inicia o servidor HTTP
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Servidor escutando na porta ${PORT} - PID: ${process.pid}`);
    });
  })
  .catch((err) => {
    logger.error('Erro ao inicializar KafkaService', { error: err.message });
    process.exit(1);
  });
