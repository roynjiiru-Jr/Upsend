import { Hono } from 'hono';
import type { Bindings, MagicLinkRequest, VerifyMagicLinkRequest } from '../types';
import { generateToken, createSession } from '../utils/auth';

const auth = new Hono<{ Bindings: Bindings }>();

// Request magic link
auth.post('/magic-link', async (c) => {
  try {
    const { email, name }: MagicLinkRequest = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const db = c.env.DB;
    const magicToken = generateToken(32);
    const expiresAt = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutes

    // Check if user exists
    const existingUser = await db.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
      // Update existing user with magic token
      await db.prepare(`
        UPDATE users 
        SET magic_token = ?, magic_token_expires_at = ?
        WHERE email = ?
      `).bind(magicToken, expiresAt, email).run();
    } else {
      // Create new user
      if (!name) {
        return c.json({ error: 'Name is required for new users' }, 400);
      }
      
      await db.prepare(`
        INSERT INTO users (email, name, magic_token, magic_token_expires_at)
        VALUES (?, ?, ?, ?)
      `).bind(email, name, magicToken, expiresAt).run();
    }

    // In production, send email with magic link
    // For MVP, we'll return the token (in production, this should be sent via email)
    const magicLink = `/auth/verify?token=${magicToken}`;
    
    return c.json({ 
      success: true, 
      message: 'Magic link sent to your email',
      // For MVP testing only - remove in production
      dev_token: magicToken,
      dev_link: magicLink
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return c.json({ error: 'Failed to send magic link' }, 500);
  }
});

// Verify magic link and create session
auth.post('/verify', async (c) => {
  try {
    const { token }: VerifyMagicLinkRequest = await c.req.json();
    
    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const db = c.env.DB;
    const now = Math.floor(Date.now() / 1000);

    // Find user with valid magic token
    const user = await db.prepare(`
      SELECT id, email, name
      FROM users 
      WHERE magic_token = ? AND magic_token_expires_at > ?
    `).bind(token, now).first();

    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Clear magic token
    await db.prepare(`
      UPDATE users 
      SET magic_token = NULL, magic_token_expires_at = NULL
      WHERE id = ?
    `).bind(user.id).run();

    // Create session
    const sessionToken = await createSession(db, user.id as number);

    return c.json({ 
      success: true,
      session_token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    return c.json({ error: 'Failed to verify token' }, 500);
  }
});

// Get current user info
auth.get('/me', async (c) => {
  try {
    const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') || 
                         c.req.cookie('session_token');
    
    if (!sessionToken) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const db = c.env.DB;
    const now = Math.floor(Date.now() / 1000);

    const user = await db.prepare(`
      SELECT u.id, u.email, u.name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ? AND s.expires_at > ?
    `).bind(sessionToken, now).first();

    if (!user) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    return c.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Failed to get user info' }, 500);
  }
});

// Logout
auth.post('/logout', async (c) => {
  try {
    const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') || 
                         c.req.cookie('session_token');
    
    if (sessionToken) {
      const db = c.env.DB;
      await db.prepare(`
        DELETE FROM sessions WHERE session_token = ?
      `).bind(sessionToken).run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Failed to logout' }, 500);
  }
});

export default auth;
