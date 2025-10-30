// __tests__/auth/jwt.test.ts

import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken, JwtPayload } from '../../utils/jwt';

describe('JWT Utils', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, JWT_SECRET: 'test_secret_key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('signAccessToken', () => {
    it('should sign a valid access token', () => {
      const payload: JwtPayload = {
        sub: 'user123',
        role: 'admin',
        email: 'test@example.com'
      };

      const token = signAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct expiration (15 minutes)', () => {
      const payload: JwtPayload = {
        sub: 'user123',
        role: 'manager',
        email: 'test@example.com'
      };

      const token = signAccessToken(payload);
      const decoded = jwt.decode(token) as any;
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(900); // 15 minutes = 900 seconds
    });

    it('should use default secret when JWT_SECRET not set', () => {
      delete process.env.JWT_SECRET;
      
      const payload: JwtPayload = {
        sub: 'user123',
        role: 'casual',
        email: 'test@example.com'
      };

      const token = signAccessToken(payload);
      
      // Verify with default secret
      const decoded = jwt.verify(token, 'dev_secret') as JwtPayload;
      expect(decoded.sub).toBe(payload.sub);
    });
  });

  describe('verifyAccessToken', () => {
    const validPayload: JwtPayload = {
      sub: 'user123',
      role: 'head',
      email: 'test@example.com'
    };

    it('should verify a valid token', () => {
      // Use signAccessToken to ensure same secret is used
      const token = signAccessToken(validPayload);
      
      const decoded = verifyAccessToken(token);
      
      // Match only the payload fields, ignore JWT standard fields (exp, iat)
      expect(decoded).toMatchObject(validPayload);
      expect(decoded?.sub).toBe(validPayload.sub);
      expect(decoded?.role).toBe(validPayload.role);
      expect(decoded?.email).toBe(validPayload.email);
    });

    it('should return null for undefined token', () => {
      expect(verifyAccessToken(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(verifyAccessToken('')).toBeNull();
    });

    it('should return null for invalid token', () => {
      expect(verifyAccessToken('invalid.token.here')).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiredToken = jwt.sign(validPayload, 'test_secret_key', { expiresIn: '-1s' });
      expect(verifyAccessToken(expiredToken)).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const token = jwt.sign(validPayload, 'wrong_secret', { expiresIn: '15m' });
      expect(verifyAccessToken(token)).toBeNull();
    });

    it('should return null for malformed token', () => {
      expect(verifyAccessToken('header.payload')).toBeNull();
    });
  });

  describe('Integration: Sign and Verify', () => {
    it('should successfully sign and verify token', () => {
      const payload: JwtPayload = {
        sub: 'integration_user',
        role: 'admin',
        email: 'integration@example.com'
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      // Match only payload fields, JWT adds exp and iat
      expect(decoded).toMatchObject(payload);
      expect(decoded?.sub).toBe(payload.sub);
      expect(decoded?.role).toBe(payload.role);
      expect(decoded?.email).toBe(payload.email);
    });

    it('should handle all valid roles', () => {
      const roles: Array<'admin' | 'casual' | 'head' | 'manager'> = 
        ['admin', 'casual', 'head', 'manager'];

      roles.forEach((role, idx) => {
        const payload: JwtPayload = {
          sub: `user${idx}`,
          role,
          email: `${role}@test.com`
        };

        const token = signAccessToken(payload);
        const decoded = verifyAccessToken(token);
        
        // Match payload fields, ignore JWT standard fields
        expect(decoded).toMatchObject(payload);
        expect(decoded?.sub).toBe(payload.sub);
        expect(decoded?.role).toBe(role);
        expect(decoded?.email).toBe(payload.email);
      });
    });
  });
});