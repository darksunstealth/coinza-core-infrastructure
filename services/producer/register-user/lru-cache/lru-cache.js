import { LRUCache } from 'lru-cache';

class LruCache {
  /**
   * Cria uma nova instância do cache LRU.
   * @param {Object} options - Opções de configuração para o lru-cache.
   * Exemplo de options:
   * {
   *   max: 500,               // Número máximo de itens
   *   ttl: 1000 * 60 * 5      // Tempo de expiração padrão (ms)
   * }
   */
  constructor(options = {}) {
    // Se nenhuma opção obrigatória for fornecida, definir um valor padrão para "max"
    if (!options.max && !options.maxSize && !options.ttl) {
      options.max = 5000; // exemplo: máximo de 500 itens
    }

    this.cache = new LRUCache(options);
  }

  /**
   * Adiciona ou atualiza um valor no cache.
   * @param {string} key - Chave para armazenar o valor.
   * @param {*} value - Valor a ser armazenado.
   * @param {number} [ttl] - Tempo de expiração em milissegundos para esse item (opcional).
   */
  set(key, value, ttl) {
    if (ttl) {
      this.cache.set(key, value, { ttl });
    } else {
      this.cache.set(key, value);
    }
  }

  /**
   * Recupera o valor armazenado para uma dada chave.
   * @param {string} key - Chave do valor que se deseja recuperar.
   * @returns {*} - O valor associado à chave ou undefined se não existir.
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Verifica se uma chave existe no cache.
   * @param {string} key - Chave que se deseja verificar.
   * @returns {boolean} - true se a chave existir, caso contrário false.
   */
  has(key) {
    return this.cache.has(key);
  }
}

export default LruCache;
