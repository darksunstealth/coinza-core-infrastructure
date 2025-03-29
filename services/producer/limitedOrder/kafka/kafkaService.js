import { Kafka, logLevel } from 'kafkajs';

export default class KafkaService {
  constructor(brokers, clientId, options = {}) {
    this.kafka = new Kafka({
      clientId,
      brokers,
      connectionTimeout: options.connectionTimeout || 20000, // 20 segundos
      requestTimeout: options.requestTimeout || 120000,       // 120 segundos
      logLevel: logLevel.INFO,
    });

    this.producer = this.kafka.producer({
      linger: options.linger,
      batchSize: options.batchSize,
      compression: options.compression,
    });

    // Timeout para a operação de envio (em milissegundos)
    this.sendTimeout = options.sendTimeout || 30000; // 30 segundos por padrão
  }

  async initialize() {
    try {
      await this.producer.connect();
      console.info('Kafka Producer conectado com sucesso.');
    } catch (error) {
      console.error('Erro ao conectar Kafka Producer:', error);
      throw error;
    }
  }

  async send(topic, messages) {
    console.info(`Tentando enviar mensagens para o Kafka. Tópico: ${topic}`, { messages });
    try {
      const result = await Promise.race([
        this.producer.send({
          topic,
          messages,
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timeout ao enviar mensagem para Kafka'));
          }, this.sendTimeout);
        })
      ]);
      console.info(`Mensagens enviadas com sucesso para o Kafka. Tópico: ${topic}`, { result });
      return result;
    } catch (error) {
      console.error(`Erro ao enviar mensagens para o Kafka. Tópico: ${topic}`, { error });
      throw error;
    }
  }
}
