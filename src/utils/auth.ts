import { Context } from 'hono';
import type { Bindings, User } from '../types';

// Generate a random token
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

// Generate a short random code for shareable links
export function generateShareableCode(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

// Get current user from session
export async function getCurrentUser(c: Context<{ Bindings: Bindings }>): Promise<User | null> {
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') || 
                       c.req.cookie('session_token');
  
  if (!sessionToken) {
    return null;
  }

  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Check session validity
  const session = await db.prepare(`
    SELECT s.*, u.id, u.email, u.name, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.session_token = ? AND s.expires_at > ?
  `).bind(sessionToken, now).first();

  if (!session) {
    return null;
  }

  return {
    id: session.id as number,
    email: session.email as string,
    name: session.name as string,
    created_at: session.created_at as number
  };
}

// Create a new session for user
export async function createSession(db: D1Database, userId: number): Promise<string> {
  const sessionToken = generateToken(48);
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

  await db.prepare(`
    INSERT INTO sessions (user_id, session_token, expires_at)
    VALUES (?, ?, ?)
  `).bind(userId, sessionToken, expiresAt).run();

  return sessionToken;
}

// Middleware to require authentication
export async function requireAuth(c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) {
  const user = await getCurrentUser(c);
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Store user in context for use in handlers
  c.set('user', user);
  await next();
}
