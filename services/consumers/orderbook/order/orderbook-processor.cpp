#include "orderbook-processor.h"
#include <iostream>
#include <chrono>
#include <ctime>
#include <sstream>
#include <unordered_map>
#include <cstdlib>

// Função auxiliar para gerar um orderID único usando timestamp em milissegundos
static std::string generateOrderID() {
    auto now = std::chrono::system_clock::now();
    auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
    return std::to_string(millis);
}

// Construtor
OrderProcessor::OrderProcessor(RedisClient& client) : redisClient(client) {}

// Função para processar a ordem
void OrderProcessor::processOrder(const std::string& orderData, double price) {
    std::cout << "🔄 Processando ordem: " << orderData << std::endl;

    // Se orderData estiver vazio, usa "NULL" como orderID; caso contrário, gera um ID único
    std::string orderID = orderData.empty() ? "NULL" : generateOrderID();

    // Obtém o timestamp atual como string (em segundos)
    auto now = std::chrono::system_clock::now();
    std::time_t now_time = std::chrono::system_clock::to_time_t(now);
    std::string timestamp = std::to_string(now_time);

    // Se não houver dados (orderData vazio), todos os campos serão "NULL"
    // Caso haja dados, use valores de exemplo (ou extraia-os de orderData)
    std::string userID          = orderData.empty() ? "NULL" : "user123";
    std::string amount          = orderData.empty() ? "NULL" : "100";       // Exemplo: quantidade
    std::string market          = orderData.empty() ? "NULL" : "BTC-USD";   // Exemplo: mercado
    std::string isMaker         = orderData.empty() ? "NULL" : "0";         // "0" para false, "1" para true
    std::string side            = orderData.empty() ? "NULL" : "buy";       // Lado da ordem (buy/sell)
    std::string matchedOrders   = "NULL";  // Pode ser "NULL" mesmo se houver dados
    std::string orderType       = orderData.empty() ? "NULL" : "limit";     // Exemplo: tipo de ordem
    std::string executedAmount  = orderData.empty() ? "NULL" : "0";         // Quantidade executada
    std::string remainingAmount = orderData.empty() ? "NULL" : amount;      // Inicialmente igual a amount
    std::string fee             = orderData.empty() ? "NULL" : "0";         // Taxa
    std::string feeCurrency     = orderData.empty() ? "NULL" : "USD";       // Moeda da taxa
    std::string stopPrice       = orderData.empty() ? "NULL" : "0";         // Preço de stop (se aplicável)
    std::string triggered       = orderData.empty() ? "NULL" : "0";         // Flag ou timestamp de disparo
    std::string source          = orderData.empty() ? "NULL" : "API";       // Fonte da ordem
    std::string clientOrderID   = orderData.empty() ? "NULL" : "";          // ID opcional enviado pelo cliente
    std::string comment         = orderData.empty() ? "NULL" : "";          // Comentários opcionais

    // Define as chaves do Redis:
    // 1. Sorted set: "orderbook:<market>" (se market for "NULL", ficará "orderbook:NULL")
    std::string sortedSetKey = "orderbook:" + market;
    // 2. Hash: "order:<orderID>"
    std::string hashKey = "order:" + orderID;

    // Inicia um pipeline no Redis para agrupar os comandos
    auto pipe = redisClient.pipeline();

    // 1. Adiciona a ordem ao sorted set: usa a chave, o orderID como membro e o preço como score
    // Se não houver dados, o preço pode ser 0 (ou outro valor default)
    double scoreValue = orderData.empty() ? 0.0 : price;
    pipe.zadd(sortedSetKey, orderID, scoreValue);

    // 2. Cria o hash com os dados detalhados da ordem usando um unordered_map
    std::unordered_map<std::string, std::string> orderFields = {
        {"ORDERID", orderID},
        {"USERID", userID},
        {"PRICE", orderData.empty() ? "NULL" : std::to_string(price)},
        {"AMOUNT", amount},
        {"MARKET", market},
        {"ISMAKER", isMaker},
        {"SIDE", side},
        {"MATCHEDORDERS", matchedOrders},
        {"CREATED_AT", timestamp},
        {"UPDATED_AT", timestamp},
        {"STATUS", orderData.empty() ? "NULL" : "PENDING"},
        {"ORDER_TYPE", orderType},
        {"EXECUTED_AMOUNT", executedAmount},
        {"REMAINING_AMOUNT", remainingAmount},
        {"FEE", fee},
        {"FEE_CURRENCY", feeCurrency},
        {"STOP_PRICE", stopPrice},
        {"TRIGGERED", triggered},
        {"SOURCE", source},
        {"CLIENT_ORDER_ID", clientOrderID},
        {"COMMENT", comment}
    };

    // Chama hset passando os iteradores do unordered_map
    pipe.hset(hashKey, orderFields.begin(), orderFields.end());

    // Executa o pipeline (envia todos os comandos para o Redis de uma vez)
    pipe.exec();

    std::cout << "✅ Ordem armazenada no Redis com hash key: " << hashKey
              << " e no sorted set: " << sortedSetKey << std::endl;
}
