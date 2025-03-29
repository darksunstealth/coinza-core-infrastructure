#include "redis-client.h"
#include <iostream>
#include <iterator>  // For std::inserter
#include <sw/redis++/redis++.h>

// Using sw::redis names for convenience.
using sw::redis::BoundedInterval;
using sw::redis::BoundType;

RedisClient::RedisClient(const std::string &redisURI)
    : _redis(redisURI)
{}

void RedisClient::set(const std::string &key, const std::string &value) {
    _redis.set(key, value);
}

std::string RedisClient::get(const std::string &key) {
    auto result = _redis.get(key);
    return result ? *result : "";
}

void RedisClient::hset(const std::string &key,
                       const std::unordered_map<std::string, std::string> &values) {
    _redis.hset(key, values.begin(), values.end());
}

// Updated hgetall using an output iterator:
std::unordered_map<std::string, std::string> RedisClient::hgetall(const std::string &key) {
    std::unordered_map<std::string, std::string> result;
    _redis.hgetall(key, std::inserter(result, result.end()));
    return result;
}

void RedisClient::zadd(const std::string &key, double score, const std::string &member) {
    _redis.zadd(key, member, score);
}

sw::redis::Pipeline RedisClient::pipeline() {
    return _redis.pipeline();
}

std::vector<std::string> RedisClient::zrangebyscore(const std::string &key, double min, double max) {
    std::vector<std::string> members;
    try {
        // Create the interval as expected by Redis++.
        auto interval = BoundedInterval<double>(min, max, BoundType::CLOSED);
        _redis.zrangebyscore(key, interval, std::back_inserter(members));
    } catch (const sw::redis::Error &err) {
        // This line may trigger an IntelliSense warning,
        // but it should compile correctly.
        std::cerr << "Erro em zrangebyscore: " << err.what() << "\n";
    }
    return members;
}
