import { Kafka, logLevel } from 'kafkajs';

export default class KafkaService {
  constructor(brokers, clientId, options = {}) {
    this.kafka = new Kafka({
      clientId,
      brokers,
      connectionTimeout: options.connectionTimeout || 20000, // 20 segundos (ajustado)
      requestTimeout: options.requestTimeout || 120000,       // 120 segundos (ajustado)
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
    // Implementa um timeout para o envio utilizando Promise.race
    return await Promise.race([
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
  }
}
