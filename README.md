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

kubectl config use-context minikube


kubectl apply -f k8s/zookeeper/zookeeper-deployment.yaml
kubectl apply -f k8s/zookeeper/zookeeper-service.yaml
kubectl apply -f k8s/kafka/kafka-statefulset.yaml
kubectl apply -f k8s/kafka/kafka-service.yaml

kubectl port-forward svc/matching-engine 8080:80 -n matching-engine

kubectl logs -l app=matching-engine -n matching-engine --tail=100 --follow

kubectl logs matching-engine-7cd648897d-7hlkz -n matching-engine
kubectl logs -f matching-engine-7cd648897d-7hlkz -n matching-engine
kubectl logs -l app=matching-engine -n matching-engine --tail=100 --follow
kubectl logs --previous matching-engine-7cd648897d-7hlkz -n matching-engine



docker build -t samirsauma/matching-engine:v78 .
docker push samirsauma/matching-engine:v78



docker build -t samirsauma/init-variables-on-redis:v4 .
docker push samirsauma/init-variables-on-redis:v4



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




/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-kafka-bootstrap:9092 \
  --create \
  --topic order_topic \
  --partitions 3 \
  --replication-factor 1


/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-kafka-bootstrap:9092 \
  --list




https://github.com/unclecode/crawl4ai https://github.com/stanford-oval/storm https://github.com/kyegomez/swarms https://github.com/The-Swarm-Corporation/swarms-examples?tab=readme-ov-file https://github.com/David-patrick-chuks/Riona-AI-Agent
