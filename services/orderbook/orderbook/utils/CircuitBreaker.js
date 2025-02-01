class CircuitBreaker {
    constructor(maxFailures, resetTimeout) {
        this.maxFailures = maxFailures;
        this.resetTimeout = resetTimeout;
        this.failureCount = 0;
        this.state = 'CLOSED';
        this.nextAttempt = Date.now();
    }

    async call(action) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF';
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await action();
            this.reset();
            return result;
        } catch (err) {
            this.failureCount++;
            if (this.failureCount >= this.maxFailures) {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.resetTimeout;
                this.logger.warn('Circuit breaker aberto devido a múltiplas falhas.');
            }
            throw err;
        }
    }

    reset() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
}
export default CircuitBreaker