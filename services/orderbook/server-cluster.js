// server-cluster.js
import cluster from "node:cluster";
import os from "os";

const numWorkers = 7; // Definição fixa de 3 workers

// Se for processo primário (master):
if (cluster.isPrimary) {
  console.log(`Master PID ${process.pid} iniciado, forkeando ${numWorkers} workers...`);

  // Cria exatamente 3 workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  // Caso algum worker morra, recria
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} morreu (code=${code}, signal=${signal}). Forkando outro...`);
    cluster.fork();
  });
} else {
  // Se for processo worker, apenas importa o server original
  console.log(`Worker PID ${process.pid} inicializado...`);
  await import("./server.js");
}
