import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  insecureSkipTLSVerify: true,
  stages: [
    { duration: '30s', target: 1500 },
    { duration: '1m', target: 3000 },
    { duration: '2m', target: 5000 },
    { duration: '10m', target: 15000 },
    { duration: '30s', target: 0 },
  ],
};

const BASE_URL = 'http://127.0.0.1:3000';  
const REGISTER_ENDPOINT = '/register';
const LOGIN_ENDPOINT = '/login';

export default function () {
  // Gera um usuário único para cada VU/iteração
  const randomNum = Math.floor(Math.random() * 1000000);
  const email = `user${randomNum}@example.com`;
  const password = 'TestPassword123!';

  // Configura os headers e o timeout para as requisições
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  };

  // --- Registro de usuário ---
  const registerPayload = JSON.stringify({
    email: email,
    password: password,
    terms: true,
  });

  const registerRes = http.post(`${BASE_URL}${REGISTER_ENDPOINT}`, registerPayload, params);

  const registerCheck = check(registerRes, {
    'Registro: Status code é 200': (r) => r.status === 200,
    'Registro: Mensagem de sucesso presente': (r) => r.body.indexOf('sucesso') !== -1,
  });

  if (!registerCheck) {
    console.error(`Erro no registro. Status: ${registerRes.status}, Body: ${registerRes.body}`);
    return; // Para essa iteração, se o registro falhar, não tenta o login
  }

  // Aguarda um curto período, se necessário (por exemplo, se houver processamento assíncrono)
  sleep(1);

  // --- Login do usuário cadastrado ---
  const loginPayload = JSON.stringify({
    email: email,
    password: password,
  });

  const loginRes = http.post(`${BASE_URL}${LOGIN_ENDPOINT}`, loginPayload, params);

  check(loginRes, {
    'Login: Status code é 200': (r) => r.status === 200,
    'Login: Token ou dado de sessão presente': (r) => {
      try {
        const body = JSON.parse(r.body);
        // Aqui assume-se que o retorno do login possui uma propriedade 'token' ou 'data'
        return body.token !== undefined || body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  // Intervalo entre iterações
  sleep(1);
}
