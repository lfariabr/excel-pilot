// routes/auth/mutations.ts
import { Router, Request, Response, NextFunction } from 'express';
import UserModel from '../../models/User';
import { AppError } from '../../utils/errorHandler';
import { signAccessToken } from '../../utils/jwt';
import { logHTTP, logAuth, logError } from '../../utils/logger';

const router = Router();

/**
 * POST /auth/register
 * Register new user account
 * 
 * @body { name, email, password, role }
 * @returns { accessToken, user }
 * 
 * Testing:
 * curl -X POST http://localhost:4000/auth/register \
 *   -H "Content-Type: application/json" \
 *   -d '{"name":"John Doe","email":"john@example.com","password":"password123","role":"casual"}'
 */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password, role } = req.body;

        logAuth('REST POST /auth/register - Registration attempt', {
            method: req.method,
            path: req.path,
            email,
            role
        });

        // Validation: Required fields
        if (!name || !email || !password || !role) {
            logError('REST POST /auth/register - Missing fields', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                providedFields: { 
                    name: !!name, 
                    email: !!email, 
                    password: !!password, 
                    role: !!role 
                }
            });
            throw new AppError(400, 'Missing required fields: name, email, password, role');
        }

        // Validation: Password length
        if (password.length < 8) {
            logError('REST POST /auth/register - Password too short', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email,
                passwordLength: password.length
            });
            throw new AppError(400, 'Password must be at least 8 characters long');
        }

        // Validation: Email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            logError('REST POST /auth/register - Invalid email format', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(400, 'Invalid email format');
        }

        // Validation: Role enum
        const validRoles = ['admin', 'casual', 'head', 'manager'];
        if (!validRoles.includes(role)) {
            logError('REST POST /auth/register - Invalid role', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                role,
                validRoles
            });
            throw new AppError(400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        // Business logic: Check for duplicate email
        const exists = await UserModel.findOne({ email }).lean();
        if (exists) {
            logAuth('REST POST /auth/register - Duplicate email', {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(409, 'User with this email already exists');
        }

        // Create user (password will be hashed by pre-save hook)
        const user = await UserModel.create({ 
            name, 
            email, 
            password, 
            role 
        });

        // Generate JWT token
        const accessToken = signAccessToken({
            sub: user?._id?.toString() ?? '',
            email: user.email,
            role: user.role
        });

        // Convert to plain object and remove password
        const { password: _, ...userResponse } = user.toObject();

        logAuth('REST POST /auth/register - User registered successfully', {
            method: req.method,
            path: req.path,
            userId: user?._id?.toString() ?? '',
            email,
            role
        });

        res.status(201).json({ 
            accessToken, 
            user: userResponse 
        });
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST POST /auth/register - Error', error as Error, {
                method: req.method,
                path: req.path,
                email: req.body.email
            });
        }
        next(error);
    }
});

/**
 * POST /auth/login
 * Authenticate user and get JWT token
 * 
 * @body { email, password }
 * @returns { accessToken, user }
 * 
 * Testing:
 * curl -X POST http://localhost:4000/auth/login \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"john@example.com","password":"password123"}'
 */
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        logAuth('REST POST /auth/login - Login attempt', {
            method: req.method,
            path: req.path,
            email
        });

        // Validation: Required fields
        if (!email || !password) {
            logError('REST POST /auth/login - Missing credentials', new Error('Validation failed'), {
                method: req.method,
                path: req.path,
                providedFields: { email: !!email, password: !!password }
            });
            throw new AppError(400, 'Email and password are required');
        }

        // Find user and explicitly select password field
        const user = await UserModel.findOne({ email }).select('+password');
        
        if (!user) {
            logAuth('REST POST /auth/login - User not found', {
                method: req.method,
                path: req.path,
                email
            });
            throw new AppError(401, 'Invalid credentials');
        }

        // Verify password using model method
        const isValidPassword = await user.comparePassword(password);
        
        if (!isValidPassword) {
            logAuth('REST POST /auth/login - Invalid password', {
                method: req.method,
                path: req.path,
                email,
                userId: user?._id?.toString() ?? ''
            });
            throw new AppError(401, 'Invalid credentials');
        }

        // Generate JWT token
        const accessToken = signAccessToken({
            sub: user._id?.toString() ?? '',
            email: user.email,
            role: user.role
        });

        // Convert to plain object and remove password
        const userObj = user.toObject();
        const { password: _, ...userResponse } = userObj;

        logAuth('REST POST /auth/login - Login successful', {
            method: req.method,
            path: req.path,
            userId: user._id?.toString() ?? '',
            email,
            role: user.role
        });

        res.status(200).json({ 
            accessToken, 
            user: userResponse 
        });
    } catch (error) {
        if (!(error instanceof AppError)) {
            logError('REST POST /auth/login - Error', error as Error, {
                method: req.method,
                path: req.path,
                email: req.body.email
            });
        }
        next(error);
    }
});

export default router;