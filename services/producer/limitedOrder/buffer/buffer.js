import fastq from 'fastq';
import { encode } from '@msgpack/msgpack';

export default class OrderBuffer {
  constructor({ batchSize = 150, flushInterval = 500, maxQueueSize = 55000 } = {}, flushCallback, logger) {
    if (typeof flushCallback !== 'function') {
      throw new Error('flushCallback must be a function');
    }

    this.logger = logger || console;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.maxQueueSize = maxQueueSize;
    this.flushCallback = flushCallback;

    this.orderBuffer = [];
    this.flushInProgress = false; // Flag para evitar flushes duplicados
    this.queue = fastq.promise(this._flushBatch.bind(this), 1);

    this.logger.info(`OrderBuffer inicializado: batchSize=${this.batchSize}, flushInterval=${this.flushInterval}ms, maxQueueSize=${this.maxQueueSize}`);

    // Inicia flush periódico
    this._startPeriodicFlush();
  }

  async addOrder(order) {
    this.logger.debug(`Recebida nova ordem: ${JSON.stringify(order)}`);

    if (this.orderBuffer.length >= this.maxQueueSize) {
      this.logger.warn(`Fila cheia (${this.orderBuffer.length}/${this.maxQueueSize}). Ordem rejeitada.`);
      throw new Error('Order queue is full. Please try again later.');
    }

    this.orderBuffer.push(order);
    this.logger.info(`Ordem adicionada ao buffer. Buffer atual: ${this.orderBuffer.length}/${this.maxQueueSize}`);

    // Se atingir batchSize, aciona flush imediato
    if (this.orderBuffer.length >= this.batchSize) {
      this.logger.info(`Buffer atingiu batchSize (${this.batchSize}). Acionando flush imediato.`);
      await this._scheduleFlush();
    }
  }

  _scheduleFlush() {
    if (this.flushInProgress) {
      this.logger.debug('Flush já em andamento. Ignorando nova solicitação.');
      return Promise.resolve();
    }
    this.logger.debug('Agendando flush imediato.');
    return this.queue.push();
  }

  async _flushBatch() {
    if (this.orderBuffer.length === 0) {
      this.logger.warn('Tentativa de flush com buffer vazio.');
      return;
    }

    this.flushInProgress = true;
    const ordersToFlush = [...this.orderBuffer];
    this.orderBuffer = [];

    this.logger.info(`Iniciando flush de ${ordersToFlush.length} ordens para o Kafka.`);

    try {
      const packedOrders = encode(ordersToFlush);
      await this.flushCallback(packedOrders);
      this.logger.info(`Flush bem-sucedido. ${ordersToFlush.length} ordens enviadas.`);
    } catch (error) {
      this.logger.error('Erro ao enviar batch para o Kafka:', { error: error.message });
    } finally {
      this.flushInProgress = false;
    }
  }
  _startPeriodicFlush() {
    setInterval(() => {
      if (this.orderBuffer.length > 0) {
        this.logger.debug(`Flush periódico acionado. Buffer atual: ${this.orderBuffer.length} ordens.`);
        this._flushBatch();
      }
    }, this.flushInterval);
  }
  
}
