import Heap from 'heap';
import { encode, decode } from '@msgpack/msgpack';
import { collectDefaultMetrics, Histogram, Counter, register } from 'prom-client';
import validator from 'validator'; // certifique-se de instalar: npm install validator

export default class MarketOrder {
  constructor(app, logger, kafkaService, redis, lrucache) {
    this.logger = logger;
    this.app = app;
    this.redis = redis;
    this.kafkaService = kafkaService;

    // Logging da inicialização
    this.logger.debug('Inicializando MarketOrder.');

    // Heaps para ordens de compra e venda
    this.orders = {
      buy: new Heap((a, b) => b.price - a.price),  // Max-heap
      sell: new Heap((a, b) => a.price - b.price),   // Min-heap
    };

    this.orderBuffer   = [];      // Buffer para acumular ordens
    this.batchSize     = 1500;     // Quantidade para acionar flush imediato
    this.maxQueueSize  = 25000;    // Limite para backpressure
    this.flushInterval = 550;      // Intervalo para flush (ms)
    this.flushTimeout  = null;
    this.flushInProgress = false;
    this.MAX_ORDERS    = 10000;    // Limite de ordens em cada heap

    // Configuração das métricas padrão do prom-client
    collectDefaultMetrics();

    // Métrica para medir a duração do flush de ordens para o Kafka
    this.flushDuration = new Histogram({
      name: 'flush_duration_seconds',
      help: 'Duração do flush de ordens para o Kafka',
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    // Métrica para medir a duração das requisições no endpoint /order
    this.orderRequestDuration = new Histogram({
      name: 'order_request_duration_seconds',
      help: 'Duração da requisição POST /order',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
    });

    // Contador para as requisições do endpoint /order
    this.orderRequestCounter = new Counter({
      name: 'order_request_total',
      help: 'Contador de requisições POST /order',
      labelNames: ['method', 'route', 'status_code'],
    });

    // Configura o endpoint de métricas e monitora uso de memória
    this.setupMetricsServer();
    this.monitorMemoryUsage();

    // Inicializa as rotas da aplicação
    this.initializeRoutes(this.app);
  }

  async initializeRoutes(app) {
    this.logger.debug('Inicializando rotas da aplicação.');
    // Rota para adicionar nova ordem com instrumentação de métricas
    app.post(
      '/order',
      //   this.middleware.check.bind(this.middleware),
      this.validateOrderPayload.bind(this),
      async (req, res) => {
        // Inicia a medição da duração da requisição
        const endTimer = this.orderRequestDuration.startTimer({
          method: req.method,
          route: '/order',
        });

        try {
          // Observe que não desestruturamos isMaker do payload,
          // pois ele será sempre definido como false.
          const { price, amount, symbol, side } = req.body;
          this.logger.info("t")

          // Cria o objeto order com isMaker sempre definido como false (market order)
          const order = {
            price,
            amount,
            symbol,  // Já estará sanitizado e em uppercase (após validação)
            isMaker: false, // Força isMaker como false
            side,    // Já estará sanitizado e em uppercase (após validação)
            // userId: req.user.id,  // Extraído pelo AuthenticationMiddleware
          };

          this.logger.info("t")

          this.logger.debug('Recebida ordem via endpoint /order', { order });

          // Processa a ordem de forma assíncrona (em background)
          this.validatedOrder(order)
            .catch(error => {
              this.logger.error('Erro ao processar ordem em background', {
                error: error.message,
                stack: error.stack,
              });
              // Aqui, você pode implementar uma lógica de retry ou notificar o erro
            });

          res.status(201).json({
            message: 'Ordem enviada com sucesso',
          });
          // Incrementa o contador com status 201 (sucesso)
          this.orderRequestCounter.inc({
            method: req.method,
            route: '/order',
            status_code: 201,
          });
        } catch (error) {
          this.logger.error('Erro no endpoint /order', { 
            error: error.message, 
            stack: error.stack 
          });
          res.status(500).json({ error: 'Internal Server Error' });
          // Incrementa o contador com status 500 (erro)
          this.orderRequestCounter.inc({
            method: req.method,
            route: '/order',
            status_code: 500,
          });
        } finally {
          // Finaliza o timer da requisição, registrando o status code atual da resposta
          endTimer({ status_code: res.statusCode });
        }
      }
    );
  }

  setupMetricsServer() {
    this.logger.debug('Configurando endpoint de métricas.');
    // Endpoint para Prometheus coletar todas as métricas
    this.app.get('/metrics/init-order', async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });
  }

  monitorMemoryUsage() {
    this.logger.debug('Iniciando monitoramento de uso de memória.');
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

  /**
   * Middleware de validação do payload da ordem.
   * Aplica diversas verificações e sanitizações.
   * Note que a propriedade isMaker não é verificada, pois será definida como false.
   */
  validateOrderPayload(req, res, next) {
    this.logger.debug('Validando payload da ordem.');
    // Desestruture apenas os campos necessários (omitindo isMaker)
    let { price, amount, symbol, side } = req.body;

    // 1. Validação de Presença de Campos Obrigatórios
    if (price === undefined || amount === undefined || symbol === undefined || side === undefined) {
      this.logger.debug('Payload incompleto', { price, amount, symbol, side });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 2. Validação de Tipos de Dados
    if (typeof price !== 'number' || typeof amount !== 'number') {
      this.logger.debug('Tipos inválidos para price ou amount', { price, amount });
      return res.status(400).json({ error: 'Price and amount must be numbers' });
    }
    if (typeof symbol !== 'string' || typeof side !== 'string') {
      this.logger.debug('Tipos inválidos para symbol ou side', { symbol, side });
      return res.status(400).json({ error: 'Symbol and side must be strings' });
    }

    // 3. Validação de Valores Positivos
    if (price <= 0 || amount <= 0) {
      this.logger.debug('Valores não positivos para price ou amount', { price, amount });
      return res.status(400).json({ error: 'Price and amount must be greater than 0' });
    }

    // 4. Sanitização de Strings: remove espaços extras e caracteres indesejados
    symbol = validator.trim(symbol);
    side = validator.trim(side);

    // 5. Validação de Formato do Símbolo
    const symbolSanitized = symbol.replace(/[-_]/g, '');
    if (!validator.isAlphanumeric(symbolSanitized)) {
      this.logger.debug('Formato inválido para symbol', { symbol });
      return res.status(400).json({ error: 'Invalid symbol format. Only alphanumeric characters, dashes, and underscores are allowed.' });
    }

    // 6. Validação de Valores Permitidos para 'side'
    side = side.toUpperCase();
    if (!['BUY', 'SELL'].includes(side)) {
      this.logger.debug('Valor inválido para side', { side });
      return res.status(400).json({ error: 'Side must be either BUY or SELL' });
    }

    // 7. Limitação de Comprimento dos Campos
    if (symbol.length > 10) {
      this.logger.debug('Symbol muito longo', { symbol });
      return res.status(400).json({ error: 'Symbol is too long. Maximum length is 10 characters.' });
    }

    // 8. Verificação de Padrões e Caracteres Maliciosos
    const blacklistPattern = /(;|--|\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC)\b)/i;
    if (blacklistPattern.test(symbol) || blacklistPattern.test(String(price)) || blacklistPattern.test(String(amount))) {
      this.logger.debug('Caracteres inválidos detectados no payload', { symbol, price, amount });
      return res.status(400).json({ error: 'Invalid characters detected in the payload' });
    }

    // 9. Validação de Precisão e Formatação dos Números (até duas casas decimais)
    const priceStr = price.toString();
    const amountStr = amount.toString();
    const decimalPattern = /^\d+(\.\d{1,2})?$/;
    if (!decimalPattern.test(priceStr)) {
      this.logger.debug('Precisão inválida para price', { price });
      return res.status(400).json({ error: 'Price must have at most two decimal places' });
    }
    if (!decimalPattern.test(amountStr)) {
      this.logger.debug('Precisão inválida para amount', { amount });
      return res.status(400).json({ error: 'Amount must have at most two decimal places' });
    }

    // 10. Validação do Backpressure e Limites do Buffer
    if (this.orderBuffer && this.orderBuffer.length >= this.maxQueueSize) {
      this.logger.warn('Order buffer full. Rejecting new order.');
      return res.status(429).json({ error: 'Order queue is full. Please try again later.' });
    }

    // Sanitiza e padroniza os campos e força isMaker para false
    req.body.symbol = symbol.toUpperCase();
    req.body.side = side;
    req.body.price = price;
    req.body.amount = amount;
    req.body.isMaker = false; // Força isMaker como false

    next();
  }

  /**
   * Validação específica para a ordem antes de adicioná-la.
   */
  validatedOrder(order) {
    this.logger.debug('Validando ordem antes de adicionar.', { order });
    if (typeof order.amount !== 'number' || order.amount <= 0) {
      this.logger.error('Ordem rejeitada devido a "amount" inválido.', { amount: order.amount });
      throw new Error('Invalid amount. Must be a positive number.');
    }
    this.addOrder(order);
    return order;
  }

  async addOrder(order) {
    this.logger.debug('Adicionando ordem.', { order });
    if (this.orderBuffer.length >= this.maxQueueSize) {
      this.logger.warn('Fila de ordens cheia. Rejeitando nova ordem.', {
        currentBufferSize: this.orderBuffer.length,
      });
      throw new Error('Order queue is full. Please try again later.');
    }

    // Seleciona a heap adequada conforme o lado da ordem
    const heap = order.side === 'BUY' ? this.orders.buy : this.orders.sell;
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

    // Agenda o flush: imediato se o batchSize for atingido ou via timeout
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
      symbol: order.symbol,
      price: order.price,
      amount: order.amount,
      isMaker: order.isMaker, // Será sempre false
    });
  }

  async flushOrdersToKafka() {
    this.logger.debug('Executando flushOrdersToKafka.');
    if (this.orderBuffer.length === 0) {
      this.logger.warn('Tentativa de flush com buffer vazio.');
      return;
    }
    if (this.flushInProgress) {
      this.logger.warn('Flush já está em andamento. Ignorando nova chamada.');
      return;
    }

    this.flushInProgress = true;
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    const endFlushTimer = this.flushDuration.startTimer();
    this.logger.info('Iniciando flush das ordens para o Kafka.', {
      bufferSize: this.orderBuffer.length,
    });

    try {
      // Serializa as ordens com MessagePack e converte para JSON
      const packedOrders = encode(this.orderBuffer);
      const ordersPayload = JSON.stringify(decode(packedOrders));

      this.logger.debug('Payload gerado para envio ao Kafka', { ordersPayload });
      this.logger.info('Enviando payload para o Kafka', {
        topic: 'order_topic',
        numberOfOrders: this.orderBuffer.length,
      });

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
      endFlushTimer();
    }
  }

  async getMarkets() {
    this.logger.debug('Obtendo mercados via lrucache.');
    const MarketKey = `MARKET:${this.marketId}`;
    await this.lrucache.get(MarketKey);
  }
}
