#ifndef REDIS_CLIENT_H
#define REDIS_CLIENT_H

#include <string>
#include <unordered_map>
#include <vector>
#include <sw/redis++/redis++.h>

class RedisClient {
private:
    // Instância do Redis
    sw::redis::Redis _redis;  

public:
    // Construtor: inicializa com a URI do Redis
    RedisClient(const std::string& redisURI);

    // Métodos básicos
    void set(const std::string& key, const std::string& value);
    std::string get(const std::string& key);

    // Métodos para manipulação de hashes
    void hset(const std::string& key, const std::unordered_map<std::string, std::string>& values);
    std::unordered_map<std::string, std::string> hgetall(const std::string& key);

    // Métodos para sorted sets
    void zadd(const std::string& key, double score, const std::string& member);
    std::vector<std::string> zrangebyscore(const std::string& key, double min, double max);

    // Pipeline
    sw::redis::Pipeline pipeline();
};

#endif
