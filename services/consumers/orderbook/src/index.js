import OrderConsumer from "./src/OrderConsumer.js";
import cacheManager from './cache/cacheManager.js';

(async () => {
    const cache = new cacheManager(); // Inicializa o Redis Cache
    const consumer = new OrderConsumer(cache); // Passa o cache para o OrderConsumer
    await consumer.listen();
})();
