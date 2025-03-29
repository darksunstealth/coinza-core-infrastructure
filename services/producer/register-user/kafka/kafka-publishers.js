// KafkaBatchPublisher.js
export default class KafkaBatchPublisher {
    /**
     * @param {KafkaService} kafkaService - Instância do KafkaService.
     * @param {string} topic - Nome do tópico.
     * @param {object} options - Opções para configuração do buffer.
     *    maxBufferSize: número máximo de mensagens antes do flush imediato (padrão: 100)
     *    flushInterval: intervalo em ms para envio periódico (padrão: 1000 ms)
     *    backpressureLimit: tamanho máximo do buffer antes de rejeitar novas mensagens (padrão: 200)
     */
    constructor(kafkaService, topic, options = {}) {
      this.kafkaService = kafkaService;
      this.topic = topic;
      this.buffer = [];
      this.maxBufferSize = options.maxBufferSize || 100;
      this.flushInterval = options.flushInterval || 1000; // em milissegundos
      this.backpressureLimit = options.backpressureLimit || 200;
      this.timer = setInterval(() => this.flushBuffer(), this.flushInterval);
    }
  
    /**
     * Adiciona uma mensagem ao buffer.
     * Caso o buffer esteja cheio além do limite de backpressure, lança um erro.
     * @param {object} message - Objeto no formato esperado pelo KafkaJS, ex: { value: 'mensagem' }
     */
    addMessage(message) {
      if (this.buffer.length >= this.backpressureLimit) {
        // Aplicando backpressure: rejeitamos novas inserções ou, alternativamente, podemos aguardar.
        throw new Error('Buffer de mensagens está cheio. Aplicando backpressure.');
      }
  
      this.buffer.push(message);
  
      // Se atingir o tamanho máximo definido para envio imediato, dispara o flush.
      if (this.buffer.length >= this.maxBufferSize) {
        this.flushBuffer();
      }
    }
  
    /**
     * Envia as mensagens acumuladas e limpa o buffer.
     */
    async flushBuffer() {
      // Se o buffer estiver vazio, nada é feito.
      if (this.buffer.length === 0) return;
  
      // Extrai as mensagens e limpa o buffer.
      const messagesToSend = this.buffer.splice(0, this.buffer.length);
      try {
        await this.kafkaService.send(this.topic, messagesToSend);
      } catch (error) {
        console.error('Erro ao enviar batch para Kafka:', error);
        // Dependendo da estratégia, podemos:
        // - Recolocar as mensagens de volta no buffer;
        // - Registrar o erro e seguir;
        // Neste exemplo, optamos por logar o erro.
      }
    }
  
    /**
     * Para o envio periódico (limpa o timer).
     */
    close() {
      clearInterval(this.timer);
    }
  }
  