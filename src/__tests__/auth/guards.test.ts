// __tests__/auth/guards.test.ts

import { GraphQLError } from 'graphql';
import { requireAuth, requireRole } from '../../utils/guards';

describe('Authentication Guards', () => {
  
  describe('requireAuth', () => {
    it('should pass when user is authenticated', () => {
      const ctx = {
        user: {
          sub: 'user123',
          role: 'casual',
          email: 'test@example.com'
        }
      };

      expect(() => requireAuth(ctx)).not.toThrow();
    });

    it('should throw UNAUTHENTICATED when user is null', () => {
      const ctx = { user: null };

      expect(() => requireAuth(ctx)).toThrow(GraphQLError);
      
      try {
        requireAuth(ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
        expect(error.message).toBe('Unauthenticated');
      }
    });

    it('should throw UNAUTHENTICATED when user is undefined', () => {
      const ctx = {};

      expect(() => requireAuth(ctx)).toThrow(GraphQLError);
      
      try {
        requireAuth(ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });
  });

  describe('requireRole', () => {
    it('should pass when user has required role', () => {
      const ctx = {
        user: {
          sub: 'user123',
          role: 'admin',
          email: 'admin@example.com'
        }
      };

      expect(() => requireRole(ctx, ['admin'])).not.toThrow();
    });

    it('should pass when user has one of multiple required roles', () => {
      const ctx = {
        user: {
          sub: 'user123',
          role: 'manager',
          email: 'manager@example.com'
        }
      };

      expect(() => requireRole(ctx, ['admin', 'manager', 'head'])).not.toThrow();
    });

    it('should throw FORBIDDEN when user lacks required role', () => {
      const ctx = {
        user: {
          sub: 'user123',
          role: 'casual',
          email: 'casual@example.com'
        }
      };

      expect(() => requireRole(ctx, ['admin'])).toThrow(GraphQLError);
      
      try {
        requireRole(ctx, ['admin']);
      } catch (error: any) {
        expect(error.extensions.code).toBe('FORBIDDEN');
        expect(error.message).toBe('Forbidden');
      }
    });

    it('should throw UNAUTHENTICATED before checking role when user is null', () => {
      const ctx = { user: null };

      expect(() => requireRole(ctx, ['admin'])).toThrow(GraphQLError);
      
      try {
        requireRole(ctx, ['admin']);
      } catch (error: any) {
        // requireRole calls requireAuth first
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should handle empty roles array (should deny all)', () => {
      const ctx = {
        user: {
          sub: 'user123',
          role: 'admin',
          email: 'admin@example.com'
        }
      };

      expect(() => requireRole(ctx, [])).toThrow(GraphQLError);
      
      try {
        requireRole(ctx, []);
      } catch (error: any) {
        expect(error.extensions.code).toBe('FORBIDDEN');
      }
    });
  });
});