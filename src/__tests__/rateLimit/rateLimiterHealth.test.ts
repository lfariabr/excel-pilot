// rateLimiterHealth.test.ts

import { rateLimiterHealth } from "../../middleware/rateLimiterHealth";

const openCircuit = (type: 'rate-limit' | 'token-budget' = 'rate-limit') => {
  for (let i = 0; i < 5; i++) {
    rateLimiterHealth.recordFailure(type);
  }
};

// Test circuit breaker functionality
describe('Circuit Breaker with Dual Strategy', () => {
    
    beforeEach(() => {
        jest.useFakeTimers();
        // Reset state before each test
        const health = rateLimiterHealth as any;
        Object.assign(health, {
            circuitState: 'closed',
            failures: 0,
            lastFailureTime: 0,
        });
        if (health.halfOpenTimer) {
            clearTimeout(health.halfOpenTimer);
            health.halfOpenTimer = undefined;
        }
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });
    
    it('should start in closed state', () => {
        expect(rateLimiterHealth.getState().state).toBe('closed');
        expect(rateLimiterHealth.isCircuitOpen()).toBe(false);
    });
    
    it('should open circuit after 5 failures', () => {
        openCircuit();
        expect(rateLimiterHealth.isCircuitOpen()).toBe(true);
    });
    
    it('should deny rate-limit requests when circuit is open', () => {
        // Open circuit
        openCircuit();
        
        expect(rateLimiterHealth.getBehaviorDuringOutage('rate-limit')).toBe('deny');
    });
    
    it('should allow token-budget requests when circuit is open', () => {
        // Open circuit
        openCircuit('token-budget');
        
        expect(rateLimiterHealth.getBehaviorDuringOutage('token-budget')).toBe('allow');
    });
    
    it('should transition to half-open after delay', () => {
        // Open circuit
        openCircuit();
        expect(rateLimiterHealth.isCircuitOpen()).toBe(true);
        
        jest.advanceTimersByTime(30_000); // instantly fast-forward
        
        expect(rateLimiterHealth.isCircuitHalfOpen()).toBe(true);
    });
    
    it('should close circuit on success during half-open', () => {
        // Open circuit
        openCircuit();
        
        jest.advanceTimersByTime(30_000); // instantly fast-forward
        expect(rateLimiterHealth.isCircuitHalfOpen()).toBe(true);
        
        // Record success
        rateLimiterHealth.recordSuccess();
        
        expect(rateLimiterHealth.getState().state).toBe('closed');
        expect(rateLimiterHealth.getState().failures).toBe(0);
    });
    
    it('should reset failure count after window expires', () => {
        // Record 4 failures (not enough to open circuit)
        for (let i = 0; i < 4; i++) {
            rateLimiterHealth.recordFailure('rate-limit');
        }
        expect(rateLimiterHealth.getState().failures).toBe(4);
        
        // Simulate 61 seconds passing (outside 60s window)
        const health = rateLimiterHealth as any;
        health.lastFailureTime = Date.now() - 61_000;
        
        // New failure should reset counter
        rateLimiterHealth.recordFailure('rate-limit');
        expect(rateLimiterHealth.getState().failures).toBe(1);
    });
    
    it('should gradually recover on success', () => {
        // Record 3 failures (not enough to open)
        for (let i = 0; i < 3; i++) {
            rateLimiterHealth.recordFailure('rate-limit');
        }
        expect(rateLimiterHealth.getState().failures).toBe(3);
        
        // Record success
        rateLimiterHealth.recordSuccess();
        expect(rateLimiterHealth.getState().failures).toBe(2);
        
        rateLimiterHealth.recordSuccess();
        expect(rateLimiterHealth.getState().failures).toBe(1);
    });
    
    it('should not reopen circuit if already open', () => {
        // Open circuit
        openCircuit();
        expect(rateLimiterHealth.isCircuitOpen()).toBe(true);
        
        // Try to open again
        rateLimiterHealth.recordFailure('rate-limit');
        
        // Should still be open (not reopened with new timer)
        expect(rateLimiterHealth.isCircuitOpen()).toBe(true);
    });
    
    it('should handle success in closed state without error', () => {
        expect(rateLimiterHealth.getState().state).toBe('closed');
        
        // Success in closed state should not cause errors
        rateLimiterHealth.recordSuccess();
        
        expect(rateLimiterHealth.getState().state).toBe('closed');
    });
    
    it('should return correct state information via getState', () => {
        // Record some failures
        rateLimiterHealth.recordFailure('rate-limit');
        rateLimiterHealth.recordFailure('rate-limit');
        
        const state = rateLimiterHealth.getState();
        
        expect(state.state).toBe('closed');
        expect(state.failures).toBe(2);
        expect(state.lastFailure).toBeGreaterThan(0);
    });
    
    it('should reopen circuit if failure occurs during half-open', () => {
        // Open circuit
        openCircuit();
        
        // Transition to half-open
        jest.advanceTimersByTime(30_000);
        expect(rateLimiterHealth.isCircuitHalfOpen()).toBe(true);
        
        // Failure during half-open should reopen circuit
        for (let i = 0; i < 5; i++) {
            rateLimiterHealth.recordFailure('rate-limit');
        }
        
        expect(rateLimiterHealth.isCircuitOpen()).toBe(true);
    });
});