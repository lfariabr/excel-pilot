export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    exceededDaily?: boolean;
    exceededMonthly?: boolean;
    source?: 'daily' | 'monthly' | 'both' | 'none';
  }