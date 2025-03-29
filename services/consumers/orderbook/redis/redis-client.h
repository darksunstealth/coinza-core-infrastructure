#ifndef REDIS_CLIENT_H
#define REDIS_CLIENT_H

#include <string>
#include <unordered_map>
#include <sw/redis++/redis++.h>

class RedisClient {
private:
    // Renomeado para _redis para evitar conflitos
    sw::redis::Redis _redis;  

public:
    // Construtor: inicializa com a URI do Redis
    RedisClient(const std::string& redisURI);

    // Métodos básicos
    void set(const std::string& key, const std::string& value);
    std::string get(const std::string& key);

    // Método para definir múltiplos campos de um hash (HSET)
    void hset(const std::string& key, const std::unordered_map<std::string, std::string>& values);

    // Método para adicionar um membro a um sorted set (ZADD)
    void zadd(const std::string& key, double score, const std::string& member);

    // Método para criar e retornar um pipeline (por valor)
    sw::redis::Pipeline pipeline();
};

#endif
