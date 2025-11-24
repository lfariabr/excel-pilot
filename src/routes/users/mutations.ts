// routes/users/mutations.ts
import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import UserModel from '../../models/User';
import { AppError } from '../../utils/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { logHTTP, logError } from '../../utils/logger';

const router = Router();

/**
 * POST /users
 * Create new user
 * 
 * @auth Not required (registration endpoint)
 * @body { name, email, password, role }
 * @returns User
 * 
 * Testing:
 * curl -X POST http://localhost:4000/users \
 *   -H "Content-Type: application/json" \
 *   -d '{"name":"Luis","email":"luis@example.com","password":"secret123","role":"admin"}'
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password, role } = req.body;

        logHTTP('REST POST /users - Create user', {
            method: req.method,
            path: req.path,
            email,
            role
        });

        // Validation: Required fields
        if (!name || !email || !password || !role) {
            logError('REST POST /users - Missing fields', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                providedFields: { 
                    name: !!name, 
                    email: !!email, 
                    password: !!password, 
                    role: !!role 
                }
            });
            throw new AppError(400, 'Missing required fields');
        }

        // Validation: Password length
        if (password.length < 8) {
            logError('REST POST /users - Password too short', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email,
                passwordLength: password.length
            });
            throw new AppError(400, "Password must be at least 8 characters long");
        }
        
        // Validation: Email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            logError('REST POST /users - Invalid email format', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(400, 'Invalid email format');
        }
        
        // Validation: Role enum
        if (!['admin', 'casual', 'head', 'manager'].includes(role)) {
            logError('REST POST /users - Invalid role', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                role
            });
            throw new AppError(400, 'Invalid role');
        }

        // Business logic: check for duplicate email
        const exists = await UserModel.findOne({ email }).lean();
        if (exists) {
            logError('REST POST /users - Duplicate email', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(400, 'User with this email already exists');
        }

        // Create user
        const user = await UserModel.create({ 
            name, 
            email, 
            password, 
            role 
        });

        // Convert user to plain object and remove password
        const { password: _, ...userResponse } = user.toObject();

        logHTTP('REST POST /users - User created successfully', {
            method: req.method,
            path: req.path,
            userId: user?._id?.toString(),
            email,
            role
        });

        res.status(201).json(userResponse);
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST POST /users - Error', error as Error, {
                method: req.method,
                path: req.path,
                email: req.body.email
            });
        }
        next(error);
    }
});

/**
 * PATCH /users/:id
 * Update user by ID
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        
        logHTTP('REST PATCH /users/:id - Update user', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id,
            updateFields: Object.keys(req.body)
        });
        
        if (!Types.ObjectId.isValid(id)) {
            logError('REST PATCH /users/:id - Invalid ID', new Error('Invalid ObjectId'), {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: id
            });
            throw new AppError(400, "Invalid id");
        }
        
        // Prevent direct password updates
        const { password, ...updateData } = req.body;
        if (password !== undefined) {
            logError('REST PATCH /users/:id - Password update attempt', new Error('Invalid operation'), {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: id
            });
            throw new AppError(400, "Use dedicated password change endpoint");
        }
        
        const doc = await UserModel.findByIdAndUpdate(
            id, 
            { $set: updateData }, 
            { new: true }
        ).lean();
        
        if (!doc) {
            logHTTP('REST PATCH /users/:id - User not found', {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: id
            });
            throw new AppError(404, "Not found");
        }
        
        logHTTP('REST PATCH /users/:id - User updated successfully', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id,
            updateFields: Object.keys(updateData)
        });
        
        res.json(doc);
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST PATCH /users/:id - Error', error as Error, {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: req.params.id
            });
        }
        next(error);
    }
});

/**
 * DELETE /users/:id
 * Delete user by ID
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        
        logHTTP('REST DELETE /users/:id - Delete user', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id
        });
        
        if (!Types.ObjectId.isValid(id)) {
            logError('REST DELETE /users/:id - Invalid ID', new Error('Invalid ObjectId'), {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: id
            });
            throw new AppError(400, "Invalid id");
        }
        
        const result = await UserModel.findByIdAndDelete(id);
        
        logHTTP('REST DELETE /users/:id - ' + (result ? 'User deleted' : 'User not found'), {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id,
            deleted: !!result
        });
        
        res.json({ ok: !!result });
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST DELETE /users/:id - Error', error as Error, {
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