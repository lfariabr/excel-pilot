export class RateLimiterHealth {
    private failures = 0;
    private lastFailureTime = 0;
    private readonly failureThreshold = 5;
    private readonly failureWindowMs = 60 * 1000; // 1 minute
    private readonly halfOpenDelayMs = 30 * 1000; // 30 seconds
    private halfOpenTimer?: NodeJS.Timeout; // Track timer for cleanup

    // Circuit states with 3 states
    private circuitState: 'closed' | 'open' | 'half-open' = 'closed';

    /**
     * Records a Redis failure and updates the circuit state.
     * @param operation - The operation that failed.
     */
    recordFailure(operation: 'rate-limit' | 'token-budget'): void {
        const now = Date.now();

        // Reset counter if outside of failure window
        if (now - this.lastFailureTime > this.failureWindowMs) {
            this.failures = 0;
        };
        this.failures++;
        this.lastFailureTime = now;

        console.error(`Redis failure recorded for ${operation}. Failures: ${this.failures}/${this.failureThreshold}`);

        if (this.failures >= this.failureThreshold) {
            this.openCircuit();
        }
    }

    /**
     * Records a succesful Redis Operation
     */
    recordSuccess(): void {
        if (this.circuitState === 'half-open') {
            console.log('✅ Circuit breaker: Redis recovered, closing circuit');
            this.closeCircuit();
        }

        // Gradual recovery: reduce failure count
        if (this.failures > 0) {
            this.failures = Math.max(0, this.failures - 1);
        }
    }

    private openCircuit(): void {
        if (this.circuitState !== 'open'){
            this.circuitState = 'open';
            console.error('🔴 CIRCUIT BREAKER OPEN - Redis unavailable, using fallback strategies');

            // Clear any existing timer before creating a new one
            if (this.halfOpenTimer) {
                clearTimeout(this.halfOpenTimer);
            }

            // Schedule transition to halfOpen after delay
            this.halfOpenTimer = setTimeout(() => {
                this.circuitState = 'half-open';
                console.warn('🟡 Circuit breaker HALF-OPEN - Testing Redis recovery');
                this.halfOpenTimer = undefined;
            }, this.halfOpenDelayMs);
        }
    }

    private closeCircuit(): void {
        this.circuitState = 'closed';
        this.failures = 0;
        this.lastFailureTime = 0;
        
        // Clear timer if closing early (before half-open transition)
        if (this.halfOpenTimer) {
            clearTimeout(this.halfOpenTimer);
            this.halfOpenTimer = undefined;
        }
    }
    /**
     * Returns the behavior for a given operation when circuit is open
     */
    getBehaviorDuringOutage(operation: 'rate-limit' | 'token-budget'): 'allow' | 'deny' {
        // Match your current fail strategies
        return operation === 'token-budget' ? 'allow' : 'deny';
    }
    
    isCircuitOpen(): boolean {
        return this.circuitState === 'open';
    }
    
    isCircuitHalfOpen(): boolean {
        return this.circuitState === 'half-open';
    }
    
    getState(): { state: string; failures: number; lastFailure: number } {
        return {
            state: this.circuitState,
            failures: this.failures,
            lastFailure: this.lastFailureTime
        };
    }
}

export const rateLimiterHealth = new RateLimiterHealth();