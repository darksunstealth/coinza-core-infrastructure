import amqp from "amqplib";

class OrderWorker {
    constructor() {
        this.queueName = "orderQueue";
    }

    async processOrder(order) {
        console.log("✅ Processando ordem:", order);
        // Aqui pode salvar no banco, acionar lógica de trading, etc.
    }

    async start() {
        try {
            const connection = await amqp.connect("amqp://localhost");
            const channel = await connection.createChannel();
            await channel.assertQueue(this.queueName, { durable: true });

            console.log("🎯 Worker pronto para processar ordens...");

            channel.consume(
                this.queueName,
                async (msg) => {
                    if (msg !== null) {
                        const order = JSON.parse(msg.content.toString());
                        await this.processOrder(order);
                        channel.ack(msg); // Confirma o processamento
                    }
                },
                { noAck: false }
            );
        } catch (error) {
            console.error("❌ Erro no Worker:", error);
        }
    }
}

// Inicia o Worker
const worker = new OrderWorker();
worker.start();
