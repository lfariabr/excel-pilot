// routes/auth/queries.ts
import { Router, Request, Response, NextFunction } from 'express';
import UserModel from '../../models/User';
import { AppError } from '../../utils/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { logHTTP, logError } from '../../utils/logger';

const router = Router();

/**
 * GET /auth/me
 * Get current authenticated user info
 * 
 * @auth Required
 * @returns User
 * 
 * Testing:
 * curl -H "Authorization: Bearer <token>" http://localhost:4000/auth/me
 */
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.sub;

        logHTTP('REST GET /auth/me - Get current user', {
            method: req.method,
            path: req.path,
            userId
        });

        const user = await UserModel.findById(userId).lean();

        if (!user) {
            logHTTP('REST GET /auth/me - User not found', {
                method: req.method,
                path: req.path,
                userId
            });
            throw new AppError(404, 'User not found');
        }

        logHTTP('REST GET /auth/me - Success', {
            method: req.method,
            path: req.path,
            userId,
            email: user.email
        });

        res.json(user);
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST GET /auth/me - Error', error as Error, {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub
            });
        }
        next(error);
    }
});

export default router;