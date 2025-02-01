#!/bin/bash

set -e

# Configurações
NAMESPACE=default
REDIS_CONFIGMAP=../k8s/redis/redis-configmap.yaml
REDIS_SERVICE=../k8s/redis/redis-service.yaml
REDIS_STATEFULSET=../k8s/redis/redis-statefulset.yaml
MATCHING_ENGINE_DEPLOYMENT=../k8s/matching-engine/deployment.yaml
MATCHING_ENGINE_IMAGE_PATH=../services/matching-engine/Dockerfile
MATCHING_ENGINE_APP_PATH=../services/matching-engine/
MATCHING_ENGINE_CONTAINER_NAME=matching-engine

# Função para aguardar até que todos os pods estejam prontos
wait_for_pods() {
  local label=$1
  echo "🔍 Aguardando pods com label '$label' estarem prontos no namespace '$NAMESPACE'..."
  kubectl wait --for=condition=Ready pod -l "$label" --namespace "$NAMESPACE" --timeout=300s
  echo "✅ Todos os pods com label '$label' estão prontos."
}

# Função para verificar se o Redis Cluster já está inicializado
is_cluster_initialized() {
  kubectl exec -n "$NAMESPACE" redis-cluster-0 -- redis-cli -c -h redis-cluster-0.redis-cluster -p 6379 cluster info | grep -q "cluster_state:ok"
}

# Aplicar ConfigMap, Service e StatefulSet do Redis
deploy_redis_cluster() {
  echo "📄 Aplicando ConfigMap do Redis..."
  kubectl apply -f "$REDIS_CONFIGMAP" --namespace "$NAMESPACE"

  echo "📄 Aplicando Service Headless do Redis..."
  kubectl apply -f "$REDIS_SERVICE" --namespace "$NAMESPACE"

  echo "📄 Aplicando StatefulSet do Redis..."
  kubectl apply -f "$REDIS_STATEFULSET" --namespace "$NAMESPACE"

  # Aguardar todos os pods do Redis estarem prontos
  wait_for_pods "app=redis"

  # Verificar se os recursos foram criados corretamente
  echo "🔍 Verificando recursos do Redis..."
  kubectl get configmap redis-config --namespace "$NAMESPACE"
  kubectl get service redis-cluster --namespace "$NAMESPACE"
  kubectl get statefulset redis-cluster --namespace "$NAMESPACE"
  kubectl get pods -l app=redis --namespace "$NAMESPACE"
}

# Inicializar o Redis Cluster
initialize_redis_cluster() {
  if is_cluster_initialized; then
    echo "⚠️ Redis Cluster já está inicializado."
    return
  fi

  echo "🚀 Inicializando o Redis Cluster..."
  
  # Executar o comando de criação do cluster
  kubectl exec -n "$NAMESPACE" redis-cluster-0 -- sh -c "echo yes | redis-cli --cluster create \
    redis-cluster-0.redis-cluster:6379 \
    redis-cluster-1.redis-cluster:6379 \
    redis-cluster-2.redis-cluster:6379 \
    redis-cluster-3.redis-cluster:6379 \
    redis-cluster-4.redis-cluster:6379 \
    redis-cluster-5.redis-cluster:6379 \
    --cluster-replicas 1"

  echo "✅ Redis Cluster inicializado com sucesso."

  # Verificar o status do cluster
  kubectl exec -n "$NAMESPACE" redis-cluster-0 -- sh -c "redis-cli -c -h redis-cluster-0.redis-cluster -p 6379 cluster info"
}

# Construir, empurrar e implantar o aplicativo matching-engine
deploy_matching_engine() {
  # Gerar um número de versão baseado no timestamp
  VERSION=v$(date +%s)

  echo "🚀 Criando versão da imagem: samirsauma/matching-engine:$VERSION"

  # Atualiza o arquivo deployment.yaml com a nova versão da imagem
  sed -i "s|image: samirsauma/matching-engine:.*|image: samirsauma/matching-engine:$VERSION|" "$MATCHING_ENGINE_DEPLOYMENT"

  echo "🛠️ Construindo imagem Docker..."
  docker build -t samirsauma/matching-engine:"$VERSION" -f "$MATCHING_ENGINE_IMAGE_PATH" "$MATCHING_ENGINE_APP_PATH"

  echo "📤 Enviando imagem para Docker Hub..."
  docker push samirsauma/matching-engine:"$VERSION"

  echo "📝 Aplicando atualização no Kubernetes..."
  kubectl apply -f "$MATCHING_ENGINE_DEPLOYMENT" --namespace "$NAMESPACE"

  echo "🔄 Reiniciando Kubernetes Deployment..."
  kubectl rollout restart deployment "$MATCHING_ENGINE_CONTAINER_NAME" --namespace "$NAMESPACE"

  echo "✅ Implantação concluída! Nova versão: $VERSION"
}

# Verificar o status do Deployment do matching-engine
verify_deployment() {
  echo "🔍 Verificando status do Deployment do matching-engine..."
  kubectl rollout status deployment "$MATCHING_ENGINE_CONTAINER_NAME" --namespace "$NAMESPACE"
  echo "✅ Deployment do matching-engine está atualizado e rodando."
}

# Executar as funções na ordem correta
main() {
  echo "🌟 Iniciando o processo de implantação do Redis Cluster e matching-engine..."

  deploy_redis_cluster
  initialize_redis_cluster
  deploy_matching_engine
  verify_deployment

  echo "🎉 Processo de implantação concluído com sucesso!"
}

# Chamar a função principal
main
