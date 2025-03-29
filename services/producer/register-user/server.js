// index.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import registerController from './register-control.js'; // Certifique-se de que o caminho esteja correto
import EmailService from './mail/mail-service.js';
import logger from './logger/logger.js';
import Cache from './lru-cache/lru-cache.js';
import allowAllCors from './cors/allow-cors.js';
import KafkaService from './kafka/kafka.js'; // Agora estamos importando a classe KafkaService

// ----- Instâncias de dependências -----
const cache = new Cache();

// Configurações do Kafka
const kafkaBrokers = [process.env.KAFKA_BROKER || '127.0.0.1:9092'];


// Criando o producer para o register (para o tópico register-api-1)
const registerClientId = `register-producer-${process.pid}`;
const registerKafka = new KafkaService(kafkaBrokers, registerClientId, {
  linger: 10,
  batchSize: 1048576,
  compression: 'gzip',
});

// Inicializa ambos os producers antes de iniciar a aplicação
async function initializeKafkaProducers() {
  try {
    await registerKafka.initialize();
    console.log('Ambos os Kafka Producers foram conectados com sucesso.');
  } catch (error) {
    console.error('Erro ao inicializar os Kafka Producers:', error);
    process.exit(1);
  }
}

// Chama a inicialização (pode ser aguardada antes de iniciar o servidor, se necessário)
initializeKafkaProducers();

// Em nosso exemplo, o EmailService usa o producer do orderbook.
// Se desejar, você pode injetar o producer que preferir em cada serviço.
const emailService = new EmailService(cache, logger);

const app = express();
app.use(express.json());
app.use(allowAllCors());

// Instancia o controlador de registro e injeta o producer do register
const registerCtrl = new registerController(
  app,
  emailService,
  cache,
  logger,
  registerKafka // Aqui o controller usará o Kafka producer específico para registros
);

// Porta padrão ou definida via variável de ambiente
const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
