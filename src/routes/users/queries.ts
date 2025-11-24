// routes/users/queries.ts
import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import UserModel from "../../models/User";
import { AppError } from "../../utils/errorHandler";
import { requireAuth } from "../../middleware/auth";
import { logHTTP, logError } from "../../utils/logger";

const router = Router();

/**
 * GET /users
 * List all users
 * 
 * @auth Required
 * @returns User[]
 * 
 * Testing:
 * curl -H "Authorization: Bearer <token>" http://localhost:4000/users
 */
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // TODO: Minor note: The logging pattern at lines 23-27, 31-36, 64-69, 94-99 is repetitive.
        // Consider extracting into a logging helper function if this pattern is used across multiple routes.
        logHTTP('REST GET /users - List all users', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub
        });
        
        const users = await UserModel.find().lean();
        
        logHTTP('REST GET /users - Success', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            resultCount: users.length
        });
        
        res.json(users);
    } catch (error) {
        logError('REST GET /users - Error', error as Error, {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub
        });
        next(error);
    }
});

/**
 * GET /users/:id
 * Get single user by ID
 * 
 * @auth Required
 * @param id MongoDB ObjectId
 * @returns User
 * 
 * Testing:
 * curl -H "Authorization: Bearer <token>" http://localhost:4000/users/507f1f77bcf86cd799439011
 */
router.get("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        
        logHTTP('REST GET /users/:id - Get user by ID', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id
        });
        
        // Validation: Check if ID is valid MongoDB ObjectId
        if (!Types.ObjectId.isValid(id)) {
            logError('REST GET /users/:id - Invalid ID', new Error('Invalid ObjectId'), {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: id
            });
            throw new AppError(400, "Invalid id");
        }
        
        const user = await UserModel.findById(id).lean();
        
        if (!user) {
            logHTTP('REST GET /users/:id - User not found', {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: id
            });
            throw new AppError(404, "User not found");
        }
        
        logHTTP('REST GET /users/:id - Success', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id
        });
        
        res.json(user);
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST GET /users/:id - Error', error as Error, {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: req.params.id
            });
        }
        next(error);
    }
});

export default router;