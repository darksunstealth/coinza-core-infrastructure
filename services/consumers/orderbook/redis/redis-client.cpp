#include "redis-client.h"
#include <iostream>

RedisClient::RedisClient(const std::string& redisURI) : _redis(redisURI) {}

void RedisClient::set(const std::string& key, const std::string& value) {
    _redis.set(key, value);
}

std::string RedisClient::get(const std::string& key) {
    auto result = _redis.get(key);
    return result ? *result : "";
}

void RedisClient::hset(const std::string& key, const std::unordered_map<std::string, std::string>& values) {
    // Define os campos do hash usando os iteradores do unordered_map
    _redis.hset(key, values.begin(), values.end());
}

void RedisClient::zadd(const std::string& key, double score, const std::string& member) {
    // Usa o overload com três parâmetros: key, member e score
    _redis.zadd(key, member, score);
}

sw::redis::Pipeline RedisClient::pipeline() {
    return _redis.pipeline();
}
