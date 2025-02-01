import Heap from 'heap';
import { encode, decode } from '@msgpack/msgpack';
import { collectDefaultMetrics, Histogram, register } from 'prom-client';
// É esperado que KafkaService seja definido/importado em outro módulo.

export default class OrderBook {
  constructor(app, logger, kafkaService) {
    this.logger = logger;
    this.app = app;

    // Heaps para ordens de compra e venda
    this.orders = {
      buy: new Heap((a, b) => b.price - a.price),  // Max-heap
      sell: new Heap((a, b) => a.price - b.price),   // Min-heap
    };

    this.orderBuffer   = [];      // Buffer para acumular ordens
    this.batchSize     = 150;     // Quantidade para acionar flush imediato
    this.maxQueueSize  = 25000;   // Limite para backpressure
    this.flushInterval = 550;     // Intervalo para flush (ms)
    this.flushTimeout  = null;
    this.flushInProgress = false;
    this.MAX_ORDERS    = 10000;   // Limite de ordens em cada heap

    // Configura métricas
    collectDefaultMetrics();
    this.flushDuration = new Histogram({
      name: 'flush_duration_seconds',
      help: 'Duração do flush de ordens para o Kafka',
      buckets: [0.1, 0.5, 1, 2, 5],
    });
    this.setupMetricsServer();
    this.monitorMemoryUsage();

    this.kafkaService = kafkaService;

    // Inicializa as rotas da aplicação
    this.initializeRoutes(this.app);
  }

  async initializeRoutes(app) {
    // Rota para adicionar nova ordem
    app.post('/order', async (req, res) => {
      try {
        const { price, amount, market, isMaker, side } = req.body;

        // Validação inicial dos campos obrigatórios
        if (
          price === undefined ||
          amount === undefined ||
          typeof price !== 'number' ||
          typeof amount !== 'number' ||
          price <= 0 ||
          amount <= 0 ||
          !market ||
          typeof market !== 'string' ||
          typeof isMaker !== 'boolean' ||
          !side ||
          typeof side !== 'string'
        ) {
          return res.status(400).json({ error: 'Missing or invalid required fields' });
        }

        // Cria a ordem garantindo que market e side estejam em lowercase
        const order = {
          price,
          amount,
          market: market.toLowerCase(),
          isMaker,
          side: side.toLowerCase()  // 'buy' ou 'sell'
        };

        await this.addOrder(order);

        return res.status(201).json({
          message: 'ordem enviada com sucesso'
        });
      } catch (error) {
        this.logger.error('Erro no endpoint /order', { error: error.message });
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  }

  setupMetricsServer() {
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });
  }

  monitorMemoryUsage() {
    setInterval(() => {
      const memory = process.memoryUsage();
      this.logger.info('Uso de memória:', {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
      });
    }, 60000);
  }

  // Valida a ordem sem atribuir um order.id
  validatedOrder(order) {
    if (typeof order.amount !== 'number' || order.amount <= 0) {
      this.logger.error('Ordem rejeitada devido a "amount" inválido.', { amount: order.amount });
      throw new Error('Invalid amount. Must be a positive number.');
    }
    return order;
  }

  async addOrder(order) {
    // Valida a ordem (não gera order.id)
    order = this.validatedOrder(order);

    // Implementa backpressure
    if (this.orderBuffer.length >= this.maxQueueSize) {
      this.logger.warn('Fila de ordens cheia. Rejeitando nova ordem.', {
        currentBufferSize: this.orderBuffer.length,
      });
      throw new Error('Order queue is full. Please try again later.');
    }

    // Seleciona a heap com base na propriedade "side"
    const heap = order.side === 'buy' ? this.orders.buy : this.orders.sell;
    heap.push(order);
    if (heap.size() > this.MAX_ORDERS) {
      const removedOrder = heap.pop();
      this.logger.debug(
        `Ordem removida da heap de ${order.side} para limitar o tamanho`,
        { removedOrder }
      );
    }

    // Adiciona a ordem ao buffer
    this.orderBuffer.push(order);
    this.logger.debug('Ordem adicionada ao buffer', {
      currentBufferSize: this.orderBuffer.length,
    });

    // Agenda o flush: imediato se batchSize atingido ou via timeout
    if (this.orderBuffer.length >= this.batchSize && !this.flushInProgress) {
      this.logger.debug('Batch size atingido. Disparando flush imediato.');
      setImmediate(() => this.flushOrdersToKafka());
    } else if (!this.flushTimeout) {
      this.logger.debug('Agendando flush via timeout.');
      this.flushTimeout = setTimeout(() => {
        this.flushTimeout = null;
        this.flushOrdersToKafka();
      }, this.flushInterval);
    }

    this.logger.info('Ordem adicionada com sucesso', {
      orderType: order.side,
      market: order.market,
      price: order.price,
      amount: order.amount,
    });
  }

  // Métodos para obter as principais ordens (compra ou venda)
  getTopOrders(side, limit = 10) {
    const heap = this.orders[side];
    const orders = heap ? heap.toArray().slice(0, limit) : [];
    this.logger.debug(`Obtendo top ${side} orders`, { limit, orders });
    return orders;
  }

  getTopBuyOrders(limit = 10) {
    return this.getTopOrders('buy', limit);
  }

  getTopSellOrders(limit = 10) {
    return this.getTopOrders('sell', limit);
  }

  async flushOrdersToKafka() {
    if (this.orderBuffer.length === 0) {
      this.logger.warn('Tentativa de flush com buffer vazio.');
      return;
    }
    if (this.flushInProgress) {
      this.logger.warn('Flush já está em andamento. Ignorando nova chamada.');
      return;
    }

    // Indica que o flush está começando e limpa o flushTimeout se existir
    this.flushInProgress = true;
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    const end = this.flushDuration.startTimer();
    this.logger.info('Iniciando flush das ordens para o Kafka.', {
      bufferSize: this.orderBuffer.length,
    });

    try {
      // Serializa as ordens com MessagePack e converte para JSON antes de enviar para o Kafka.
      const packedOrders = encode(this.orderBuffer);
      const ordersPayload = JSON.stringify(decode(packedOrders));

      this.logger.debug('Enviando payload para o Kafka', { ordersPayload });

      await this.kafkaService.send('order_topic', [{ value: ordersPayload }]);
      this.logger.info('Flush concluído com sucesso. Ordens enviadas para o Kafka.', {
        flushedOrders: this.orderBuffer.length,
        topic: 'order_topic',
      });

      // Esvazia o buffer após o flush
      this.orderBuffer = [];
      this.logger.debug('Buffer de ordens esvaziado após flush.');
    } catch (error) {
      this.logger.error('Erro ao enviar ordens para o Kafka', {
        message: error.message,
        stack: error.stack,
      });
    } finally {
      this.flushInProgress = false;
      end();
    }
  }
}
