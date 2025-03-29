// src/server.js
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { RedisService } from './redis/redis.js';
import { SocketController } from './socket/socket.js';
import LoginController from './login.js';
import LruCache from './lru-cache/lru-cache.js'
dotenv.config();

const app = express();
app.use(express.json());
 
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
// Monta a URL do Redis
const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
const lrucache = new LruCache()
// Instancia o serviço Redis usando a URL
const redisService = new RedisService({ url: redisUrl });
const login =  new LoginController(redisService, lrucache)

// Instancia o controlador de WebSocket (que agora cuidará do login via WS)
const socket = new SocketController(wss, redisService,login);

// Se o login será feito via WS, não é necessário manter a rota HTTP
// app.post('/login', (req, res) => loginController.login(req, res));

app.get('/', (req, res) => {
  res.send('Servidor rodando com Express, WebSocket, JWT, Redis e TypeScript (ESM)!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
