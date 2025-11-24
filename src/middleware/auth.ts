// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/errorHandler';

/**
 * Express middleware to verify JWT token and attach user to request
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyAccessToken(token);
    
    if (!payload) {
      throw new AppError(401, 'Invalid or expired token');
    }
    
    // Attach user to request
    (req as any).user = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, 'Authentication failed'));
    }
  }
}

/**
 * Express middleware to check user role
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return next(new AppError(401, 'Unauthenticated'));
    }
    
    if (!roles.includes(user.role)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }
    
    next();
  };
}