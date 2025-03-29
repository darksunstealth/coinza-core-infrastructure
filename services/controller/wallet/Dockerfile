# Usando uma imagem leve do Node.js
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar os arquivos necessários
COPY package*.json ./ 
RUN npm install --omit=dev

# Copiar o restante do código, incluindo a pasta redis/
COPY . .

# Expor a porta usada pela aplicação
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "base.js"]
