#include "./kafka/kafka-consumer.h"
#include "./order/orderbook-processor.h"
#include "./redis/redis-client.h"

int main() {
    std::string brokers = "127.0.0.1:30092";
    std::string topic = "MATCH_ORDER_MOTOR";
    std::string group_id = "order_consumer";
    std::string redisURI = "tcp://127.0.0.1:6379";

    // Inicializa Redis
    RedisClient redisClient(redisURI);

    // Inicializa o processador de ordens e passa o RedisClient
    OrderProcessor orderProcessor(redisClient);

    // Inicializa o KafkaConsumer e injeta o OrderProcessor
    KafkaConsumer consumer(brokers, topic, group_id, orderProcessor);
    consumer.consumeMessages();

    return 0;
}
