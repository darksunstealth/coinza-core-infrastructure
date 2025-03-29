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
const ORDER_ENDPOINT = '/order';

// Substitua pelos valores reais das suas credenciais
const API_KEY = '9e7c3d4a-8a1c-4f27-bc6a-3e9f8d70d5a1';
const API_SECRET = 'your-raw-api-secret-here';

export default function () {
    // Gera um preço aleatório entre 1000 e 100000
    const price = Math.floor(Math.random() * (100000 - 1000 + 1)) + 1000;
    // Gera uma quantidade aleatória entre 0.01 e 5 com 2 casas decimais
    const amount = (Math.random() * (5 - 0.01) + 0.01).toFixed(2);

    // Payload JSON simulando uma ordem
    const payload = JSON.stringify({
        price: price,
        amount: amount,
        market: 'btc/usdt',  // em minúsculas para bater com a validação do backend
        isMaker: true,
        side: 'buy'
    });

    // Configuração dos headers, incluindo as credenciais de API
    const params = {
        headers: { 
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-api-secret': API_SECRET,
        },
        timeout: '30s',
    };

    // Envia a requisição POST para criar a ordem
    const res = http.post(`${BASE_URL}${ORDER_ENDPOINT}`, payload, params);

    // Validações dos testes
    const checksResult = check(res, {
        'Status code é 201': (r) => r.status === 201, // Espera código 201 (Created)
        'Tempo de resposta < 500ms': (r) => r.timings.duration < 500,
        'Resposta contém a ordem': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.order && body.order.market === 'btc/usdt';
            } catch (e) {
                return false;
            }
        },
    });

    // Log detalhado em caso de falha
    if (!checksResult) {
        console.log('--- ERRO NA REQUISIÇÃO ---');
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${res.body}`);
        console.log(`Headers: ${JSON.stringify(res.headers)}`);
        console.log('--------------------------------');
    }

    sleep(1);
}
