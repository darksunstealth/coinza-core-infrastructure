#ifndef KAFKA_CONSUMER_H
#define KAFKA_CONSUMER_H

#include <string>
#include <cppkafka/cppkafka.h>
#include "../order/orderbook-processor.h"

class KafkaConsumer {
private:
    std::string brokers;
    std::string topic;
    std::string group_id;
    cppkafka::Consumer consumer;
    OrderProcessor& orderProcessor;  // Injeção de dependência para processar ordens

public:
    KafkaConsumer(const std::string& brokers, const std::string& topic, const std::string& group_id, OrderProcessor& processor);
    void consumeMessages();  // Método para consumir mensagens do Kafka
};

#endif
