sudo snap install helm --classic
kubectl apply -f k8s/redis/redis-configmap.yaml
kubectl apply -f k8s/redis/redis-pv.yaml
kubectl apply -f k8s/redis/redis-service.yaml
kubectl apply -f k8s/redis/redis-statefulset.yaml
kubectl apply -f k8s/matching-engine/deployment.yaml
kubectl apply -f k8s/matching-engine/hpa-matching-engine.yaml
kubectl apply -f k8s/matching-engine/matching-engine-service.yaml
kubectl apply -f k8s/rabbitmq/rabbitmq.yaml
kubectl apply -f k8s/postgres/postgres.yaml
kubectl apply -f k8s/matching-engine/matching-engine-ingress.yaml
kubectl apply -f k8s/popular/base/init-variables-on-redis.yaml
kubectl apply -f k8s/kafka/kafka.yaml
kubectl apply -f k8s/meuusuario-csr.yaml

kubectl create -f https://strimzi.io/install/latest?namespace=kafka




g++ -std=c++11 -o kafka_consumer orderbook.cpp -L/usr/local/lib -I/usr/local/include -lcppkafka -lrdkafka
./kafka_consumer

./bin/zookeeper-server-start.sh config/zookeeper.properties

./bin/kafka-server-start.sh config/server.properties





kubectl port-forward svc/matching-engine 8080:80 -n matching-engine

kubectl logs -l app=matching-engine -n matching-engine --tail=100 --follow

kubectl logs matching-engine-7cd648897d-7hlkz -n matching-engine
kubectl logs -f matching-engine-7cd648897d-7hlkz -n matching-engine
kubectl logs -l app=matching-engine -n matching-engine --tail=100 --follow
kubectl logs --previous matching-engine-7cd648897d-7hlkz -n matching-engine



docker build -t samirsauma/matching-engine:v78 .
docker push samirsauma/matching-engine:v78



docker build -t samirsauma/init-variables-on-redis:v6 .
docker push samirsauma/init-variables-on-redis:v6



kubectl rollout restart deployment matching-engine -n matching-engine


kubectl delete statefulset kafka -n kafka --cascade=foreground
kubectl delete statefulset zookeeper -n kafka --cascade=foreground
kubectl delete svc kafka -n kafka
kubectl delete svc zookeeper -n kafka
kubectl delete pvc -n kafka --all
kubectl delete namespace Kafka





kubectl exec -it redis-cluster-0 -n redis-cluster -- sh




redis-cli --cluster create \
  redis-cluster-0.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-1.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-2.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-3.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-4.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-5.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  --cluster-replicas 1


echo "yes" | redis-cli --cluster create \
  redis-cluster-0.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-1.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-2.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-3.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-4.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  redis-cluster-5.redis-cluster.redis-cluster.svc.cluster.local:6379 \
  --cluster-replicas 1


redis-cli -c cluster nodes


kubectl exec -it init-variables-on-redis-5tv42 -n init-variables-on-redis -- sh




kubectl create namespace kafka
kubectl apply -f https://strimzi.io/install/latest?namespace=kafka



kubectl exec -it kafka-0 -n kafka -- \
  /opt/kafka/bin/kafka-topics.sh --create \
  --topic register-api-1 \
  --bootstrap-server localhost:9092 \
  --replication-factor 1 \
  --partitions 1



https://github.com/unclecode/crawl4ai https://github.com/stanford-oval/storm https://github.com/kyegomez/swarms https://github.com/The-Swarm-Corporation/swarms-examples?tab=readme-ov-file https://github.com/David-patrick-chuks/Riona-AI-Agent





g++ -std=c++17 -o orderbook \
    main.cpp order/orderbook-processor.cpp kafka/kafka-consumer.cpp redis/redis-client.cpp \
    -I/usr/local/include \
    -L/usr/local/lib \
    -lredis++ -lhiredis -lcppkafka -lpthread


    
./bin/zookeeper-server-start.sh config/zookeeper.properties

./bin/kafka-server-start.sh config/server.properties