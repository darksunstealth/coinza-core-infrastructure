#ifndef ORDER_PROCESSOR_H
#define ORDER_PROCESSOR_H

#include <string>
#include "../redis/redis-client.h"
#include <vector>
#include <unordered_map>

class OrderProcessor {
private:
    RedisClient& redisClient;  // Injeção de dependência do Redis

    // Função auxiliar para gerar um orderID único usando timestamp em milissegundos
    static std::string generateOrderID() {
        auto now = std::chrono::system_clock::now();
        auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
        return std::to_string(millis);
    }

public:
    OrderProcessor(RedisClient& client);
    
    // Processa a ordem, realiza o matching e salva as atualizações no Redis
    void processOrder(const std::string& orderData, double price);
};

#endif
