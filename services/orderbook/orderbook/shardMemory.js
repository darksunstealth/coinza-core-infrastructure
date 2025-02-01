const numShards = 5; // Defina o número de shards conforme a carga esperada

function hash(market) {
    let hash = 0;
    for (let i = 0; i < market.length; i++) {
        hash = (hash << 5) - hash + market.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function getShard(market) {
    return `orderbook-shard-${hash(market) % numShards}`;
}
