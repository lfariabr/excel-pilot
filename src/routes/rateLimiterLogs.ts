import express from 'express';
import { rateLimitAnalytics } from '../middleware/rateLimitAnalytics';

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
router.get('/top-violators', async (req, res) => {
    try {
        const hours = req.query.hours ? Number(req.query.hours) : 24;
        const limit = req.query.limit ? Number(req.query.limit) : 10;

        if (Number.isNaN(hours) || hours <= 0) {
            return res.status(400).json({ error: 'hours must be a positive number' });
        }
        if (Number.isNaN(limit) || limit <= 0) {
            return res.status(400).json({ error: 'limit must be a positive number' });
        }

        const result = await analytics.getTopViolators(hours, limit);
        return res.json(result);
    } catch (err) {
        console.error('Error fetching top violators', err);
        return res.status(500).json({ error: 'internal error' });
    }
});

export default router;