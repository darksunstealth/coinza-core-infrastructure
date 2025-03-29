// LoginController.js
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA_AQUI';

export class LoginController {
  constructor(redis) {
    this.redis = redis;
  }

  async loginWs(data, ws) {
    const { email, password } = data;

    try {
      // Verifica se o email existe na hash USERS_EMAILS
      const exists = await this.redis.hexists('USERS_EMAILS', email);
      if (!exists) {
        ws.send(JSON.stringify({ type: 'loginResponse', success: false, message: 'Usuário não encontrado' }));
        return;
      }

      // Obtém os dados do usuário armazenados na hash
      const userDataStr = await this.redis.hget('USERS_EMAILS', email);
      const userData = JSON.parse(userDataStr);
      const userId = userData.id;

      // Verificação de senha (comentada no exemplo)
      // if (password !== userData.password) {
      //   ws.send(JSON.stringify({ type: 'loginResponse', success: false, message: 'Senha inválida' }));
      //   return;
      // }

      // Cria o payload e gera o token JWT (expira em 1 hora)
     // Dentro do método loginWs no LoginController:
const payload = { id: userId, email };
const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

// Atualiza a sessão no Redis (salva o token, com expiração de 1h)
// Correto: passando apenas o valor numérico para expiração
await this.redis.set(`session:${userId}`, token, 3600);

ws.isAuthenticated = true;
ws.user = payload;

ws.send(JSON.stringify({ type: 'loginResponse', success: true, token }));
    } catch (error) {
      console.error('Erro no login via WebSocket:', error);
      ws.send(JSON.stringify({
        type: 'loginResponse',
        success: false,
        message: 'Erro ao realizar login',
        error: error.message
      }));
    }
  }
}

export default LoginController;
