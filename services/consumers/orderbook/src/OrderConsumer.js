import Redis from "ioredis";
import NodeCache from "node-cache";

class OrderConsumer {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
        this.redis = new Redis.Cluster(
            process.env.REDIS_NODES.split(",").map((node) => {
                const [host, port] = node.split(":");
                return { host, port: Number(port) };
            }),
            {
                scaleReads: "all",
                redisOptions: {
                    password: process.env.REDIS_PASSWORD || null,
                },
            }
        );

        this.marketStreams = [];
    }

    async loadMarkets() {
        const markets = this.cacheManager.get("MARKET") || [];
        return markets.map(market => market.symbol);
    }

    async listenToMarkets() {
        const markets = await this.loadMarkets();

        if (markets.length === 0) {
            console.warn("⚠️ Nenhum market encontrado no cache.");
            return;
        }

        console.log(`🔄 Escutando streams para ${markets.length} markets...`);

        for (const market of markets) {
            for (const side of ["buy", "sell"]) {
                const streamKey = `orderbook:${market}:${side}`;
                this.marketStreams.push(this.listenToStream(streamKey));
            }
        }

        await Promise.all(this.marketStreams);
    }

    async listenToStream(streamKey) {
        console.log(`🎧 Escutando Redis Stream: ${streamKey}`);

        while (true) {
            try {
                const response = await this.redis.xread(
                    "BLOCK", 0, "STREAMS", streamKey, "$"
                );

                if (response) {
                    const [stream, messages] = response[0];

                    for (const [id, fields] of messages) {
                        const order = {
                            market: fields[1],
                            side: fields[3],
                            price: fields[5],
                            amount: fields[7],
                        };

                        console.log(`📥 Ordem recebida [${stream}]: ${JSON.stringify(order)}`);
                        // Aqui pode adicionar lógica para processar a ordem
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao processar Redis Stream (${streamKey}):`, error);
            }
        }
    }

    async start() {
        await this.listenToMarkets();
    }
}

export default OrderConsumer;
