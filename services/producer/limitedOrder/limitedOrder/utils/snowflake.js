// snowflake.js

class SnowflakeIdGenerator {
    constructor(workerId, datacenterId) {
        this.epoch = 1700000000000n; // Data de início customizada
        this.workerId = BigInt(workerId);
        this.datacenterId = BigInt(datacenterId);
        this.sequence = 0n;
        this.lastTimestamp = -1n;
    }

    getTimestamp() {
        return BigInt(Date.now()) - this.epoch;
    }

    async generateOrderId(market) {
        let timestamp = this.getTimestamp();

        if (timestamp === this.lastTimestamp) {
            this.sequence = (this.sequence + 1n) & 0xFFFn;
            if (this.sequence === 0n) {
                while (timestamp <= this.lastTimestamp) {
                    timestamp = this.getTimestamp();
                }
            }
        } else {
            this.sequence = 0n;
        }

        this.lastTimestamp = timestamp;

        const orderId = 
            (timestamp << 22n) | 
            (this.datacenterId << 17n) | 
            (this.workerId << 12n) | 
            this.sequence;

        return `${market}_${orderId.toString()}`;
    }
}

// Exportação padrão da classe
export default SnowflakeIdGenerator;

// Remova ou mova o exemplo de uso para evitar execução no momento da importação
/*
// Exemplo de uso:
const orderIdGenerator = new SnowflakeIdGenerator(1, 1);
console.log(orderIdGenerator.generateOrderId("BTC-USDT"));
*/
