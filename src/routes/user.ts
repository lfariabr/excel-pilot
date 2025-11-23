import { Router} from "express";
import { Types } from "mongoose";
import UserModel from "../models/User";
import { AppError } from "../utils/errorHandler";
import { requireAuth } from "../utils/guards";
import { logHTTP, logError } from "../utils/logger";

const router = Router();

// GET /users (list)
// -----------------------------------------------------
// curl http://localhost:4000/users
router.get("/", requireAuth, async (req, res, next) => {
    try {
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

// GET../:id
// -----------------------------------------------------
// curl http://localhost:4000/users/<_id_here>
router.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const {id } = req.params;
        
        logHTTP('REST GET /users/:id - Get user by ID', {
            method: req.method,
            path: req.path,
            userId: (req as any).user?.sub,
            targetUserId: id
        });
        
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
})

// POST
// -----------------------------------------------------
// curl -X POST http://localhost:4000/users \
//   -H "Content-Type: application/json" \
//   -d '{"name":"Luis","email":"luis@example.com","role":"admin"}'
router.post("/", async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        
        logHTTP('REST POST /users - Create user', {
            method: req.method,
            path: req.path,
            email,
            role
        });
        
        if (!name || !email || !password || !role) {
            logError('REST POST /users - Missing fields', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                providedFields: { name: !!name, email: !!email, password: !!password, role: !!role }
            });
            throw new AppError(400, "Missing required fields");
        }
        
        if (password.length < 8) {
            logError('REST POST /users - Password too short', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email,
                passwordLength: password.length
            });
            throw new AppError(400, "Password must be at least 8 characters long");
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            logError('REST POST /users - Invalid email format', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(400, 'Invalid email format');
        }
        
        if (!['admin', 'casual', 'head', 'manager'].includes(role)) {
            logError('REST POST /users - Invalid role', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                role
            });
            throw new AppError(400, 'Invalid role');
        }
        
        const exists = await UserModel.findOne({ email }).lean();
        if (exists) {
            logHTTP('REST POST /users - User already exists', {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(409, "User already exists");
        }

        const user = await UserModel.create({ name, email, password, role });
        
        logHTTP('REST POST /users - User created successfully', {
            method: req.method,
            path: req.path,
            userId: user?._id?.toString(),
            email,
            role
        });
        
        res.status(201).json(user);
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
})

// PATCH
// -----------------------------------------------------
// curl -X PATCH http://localhost:4000/users/<_id_here> \
//   -H "Content-Type: application/json" \
//   -d '{"name":"Luis","email":"luis@example.com","role":"admin"}'
router.patch("/:id", requireAuth,async (req, res, next) => {
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
        
        const doc = await UserModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
        
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
})

// DELETE
// -----------------------------------------------------
// curl -X DELETE http://localhost:4000/users/<_id_here>
router.delete("/:id", requireAuth, async (req, res, next) => {
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
    } catch (e) {
        if (!(e instanceof AppError)) {
            logError('REST DELETE /users/:id - Error', e as Error, {
                method: req.method,
                path: req.path,
                userId: (req as any).user?.sub,
                targetUserId: req.params.id
            });
        }
        next(e);
    }
});

export default router;
