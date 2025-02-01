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

export default function () {
    // Payload JSON simulando uma ordem
    const payload = JSON.stringify({
        price: 56, // Preço aleatório entre 1000 e 100000
        amount: 3, // Quantidade aleatória entre 0.01 e 5
        market: 'BTC/USDT',
        isMaker: true,
        side: 'buy'
    });

    // Configuração dos headers
    const params = {
        headers: { 'Content-Type': 'application/json' },
        timeout: '30s',
    };

    // Envia a requisição POST para criar a ordem
    const res = http.post(`${BASE_URL}${ORDER_ENDPOINT}`, payload, params);

    // Validações dos testes
    const checksResult = check(res, {
        'Status code é 201': (r) => r.status === 201, // Alterado para 201 (Created)
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
