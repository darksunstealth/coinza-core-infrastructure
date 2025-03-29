
  # ⚡ Coinza Scalling – Distributed Microservice Architecture

  This repository showcases the **microservice infrastructure** of Coinza Exchange. It includes authentication, Redis setup, PostgreSQL integration, Kafka communication, and Kubernetes deployments.

  > ⚠️ **Important:**  
  > The matching engine processor (C++ component that executed the orderbook logic) is **corrupted** and currently **non-functional**.  
  > This repo **only demonstrates the flow and architecture** of services, not the matching logic.

  > 🛠 Some files may be broken, incomplete, or in progress — but **core functionalities remain unaffected**.  
  > As soon as I find time, I’ll fix these issues and improve the system incrementally.

  > 🤝 **Feel free to contribute** if you'd like to help bring this system closer to full functionality.

  ---

  ## 📦 Stack Overview

  - **Node.js** – Core services (authentication, user management)
  - **Apache Kafka (Strimzi)** – Event-driven architecture
  - **Redis Cluster** – High-speed distributed cache
  - **PostgreSQL** – Primary relational database
  - **Zookeeper** – Kafka dependency
  - **C++** – Matching engine (currently corrupted)
  - **Kubernetes** – Deployment, scaling, and service orchestration
  - **Docker** – Container builds

  ---

  ## 🚀 Getting Started

  ### Helm + Minikube Setup

  ```bash
  sudo snap install helm --classic
  kubectl config use-context minikube
  ```

  ### Deploy Infrastructure

  ```bash
  kubectl apply -f k8s/redis/redis-configmap.yaml
  kubectl apply -f k8s/redis/redis-pv.yaml
  kubectl apply -f k8s/redis/redis-service.yaml
  kubectl apply -f k8s/redis/redis-statefulset.yaml

  kubectl apply -f k8s/postgres/postgres.yaml
  kubectl apply -f k8s/kafka/kafka.yaml
  kubectl apply -f k8s/zookeeper/zookeeper-deployment.yaml
  kubectl apply -f k8s/zookeeper/zookeeper-service.yaml
  kubectl apply -f k8s/kafka/kafka-statefulset.yaml
  kubectl apply -f k8s/kafka/kafka-service.yaml

  kubectl apply -f k8s/matching-engine/deployment.yaml
  kubectl apply -f k8s/matching-engine/hpa-matching-engine.yaml
  kubectl apply -f k8s/matching-engine/matching-engine-service.yaml
  kubectl apply -f k8s/matching-engine/matching-engine-ingress.yaml

  kubectl apply -f k8s/popular/base/init-variables-on-redis.yaml
  kubectl apply -f k8s/meuusuario-csr.yaml
  ```

  ---

  ## 🧠 Redis Cluster Setup

  ```bash
  echo "yes" | redis-cli --cluster create \
    redis-cluster-0.redis-cluster.redis-cluster.svc.cluster.local:6379 \
    redis-cluster-1.redis-cluster.redis-cluster.svc.cluster.local:6379 \
    redis-cluster-2.redis-cluster.redis-cluster.svc.cluster.local:6379 \
    redis-cluster-3.redis-cluster.redis-cluster.svc.cluster.local:6379 \
    redis-cluster-4.redis-cluster.redis-cluster.svc.cluster.local:6379 \
    redis-cluster-5.redis-cluster.redis-cluster.svc.cluster.local:6379 \
    --cluster-replicas 1
  ```

  ---

  ## 🐳 Docker

  ```bash
  docker build -t samirsauma/matching-engine:v78 .
  docker push samirsauma/matching-engine:v78

  docker build -t samirsauma/init-variables-on-redis:v6 .
  docker push samirsauma/init-variables-on-redis:v6
  ```

  ---

  ## 📡 Kafka Topics (Example)

  ```bash
  kubectl exec -it kafka-0 -n kafka -- \
    /opt/kafka/bin/kafka-topics.sh --create \
    --topic register-api-1 \
    --bootstrap-server localhost:9092 \
    --replication-factor 1 \
    --partitions 1
  ```

  ---

  ## 🔁 Restart Matching Engine

  ```bash
  kubectl rollout restart deployment matching-engine -n matching-engine
  ```

  ---

  ## 🔍 Debugging Logs

  ```bash
  kubectl logs -l app=matching-engine -n matching-engine --tail=100 --follow
  kubectl logs -f matching-engine-[pod-id] -n matching-engine
  ```

  ---

  ## 🧠 Architecture Overview (.dot)

  ```dot
  digraph CoinzaScalling {
    rankdir=LR;
    node [shape=box, style=filled, fontname="Arial", color=lightgray];

    User [label="User"];
    Ingress [label="Ingress Controller", color=lightblue];
    Register [label="Register API", color=lightgreen];
    Redis [label="Redis Cluster", color=lightpink];
    Kafka [label="Kafka", color=orange];
    Zookeeper [label="Zookeeper", color=lightyellow];
    Postgres [label="PostgreSQL"];
    Matching [label="Matching Engine (C++)", color=red, style=filled, fontcolor=white];

    User -> Ingress;
    Ingress -> Register;
    Register -> Redis [label="cache"];
    Register -> Kafka [label="produce"];
    Kafka -> Zookeeper;
    Register -> Postgres;

    // Matching engine is not wired in
  }
  ```

  ---

  ## 🧊 Final Notes

  - 🔧 Matching processor (C++) is corrupted and excluded from orchestration.
  - 🪛 Files are under construction. Expect partial implementations.
  - 🤝 Pull requests welcome to improve or complete parts of the system.

  ---

  ### ✌️ Made by Samir Sauma — Coinza Exchange WaaS
