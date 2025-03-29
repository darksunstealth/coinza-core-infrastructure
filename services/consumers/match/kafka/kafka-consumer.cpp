#include "kafka-consumer.h"
#include <iostream>
#include "../order/orderbook-processor.h"

KafkaConsumer::KafkaConsumer(const std::string& brokers, const std::string& topic, const std::string& group_id, OrderProcessor& processor)
    : brokers(brokers), topic(topic), group_id(group_id), orderProcessor(processor),
      consumer(cppkafka::Configuration{
          {"metadata.broker.list", brokers},
          {"group.id", group_id},
          {"enable.auto.commit", "true"},
          {"auto.offset.reset", "earliest"},
          {"log_level", "4"}
      }) {
    consumer.subscribe({topic});
}

void KafkaConsumer::consumeMessages() {
    std::cout << "✅ Consumer conectado ao broker e ouvindo mensagens..." << std::endl;

    while (true) {
        cppkafka::Message message = consumer.poll(std::chrono::milliseconds(500));

        if (message) {
            if (message.get_error()) {
                if (!message.is_eof()) {
                    std::cerr << "⚠️ Erro ao consumir mensagem: " << message.get_error() << std::endl;
                }
            } else {
                std::string payload = message.get_payload();
                std::cout << "📥 Mensagem recebida: " << payload << std::endl;

                // Processa a ordem recebida usando um preço default (0.0) ou extraído do payload
                orderProcessor.processOrder(payload, 0.0);

                // Confirmação manual caso o auto-commit esteja desativado
                consumer.commit(message);
            }
        }
    }
}
