import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = "15m"; // access token TTL
const REFRESH_EXPIRES_IN = "7d"; // optional

export type JwtPayload = { 
    sub: string; 
    role: string; 
    email: string 
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token?: string): JwtPayload | null {
  try {
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}