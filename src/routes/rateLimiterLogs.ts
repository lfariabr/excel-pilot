import express from 'express';
import { rateLimitAnalytics } from '../middleware/rateLimitAnalytics';
import { requireAuth } from "../utils/guards";
import { logHTTP, logError } from '../utils/logger';

const router = express.Router();
const analytics = rateLimitAnalytics;

/**
 * GET /analytics/top-violators
 * Query params:
 *   - hours: number of hours to look back (default 24)
 *   - limit: number of top results to return (default 10)
 *
 * Response: [{ userId: string, count: number }, ...]
 */
router.get('/top-violators', requireAuth, async (req, res) => {
    try {
        const hours = req.query.hours ? Number(req.query.hours) : 24;
        const limit = req.query.limit ? Number(req.query.limit) : 10;
        
        logHTTP('REST GET /analytics/top-violators - Fetch rate limit violators', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            hours,
            limit
        });

        if (Number.isNaN(hours) || hours <= 0) {
            logError('REST GET /analytics/top-violators - Invalid hours parameter', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                hours: req.query.hours
            });
            return res.status(400).json({ error: 'hours must be a positive number' });
        }
        
        if (Number.isNaN(limit) || limit <= 0) {
            logError('REST GET /analytics/top-violators - Invalid limit parameter', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                limit: req.query.limit
            });
            return res.status(400).json({ error: 'limit must be a positive number' });
        }

        const result = await analytics.getTopViolators(hours, limit);
        
        logHTTP('REST GET /analytics/top-violators - Success', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            hours,
            limit,
            violatorsCount: result.length
        });
        
        return res.json(result);
    } catch (err) {
        logError('REST GET /analytics/top-violators - Error', err as Error, {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            hours: req.query.hours,
            limit: req.query.limit
        });
        return res.status(500).json({ error: 'internal error' });
    }
});

export default router;