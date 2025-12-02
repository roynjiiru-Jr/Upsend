import { Hono } from 'hono';
import type { Bindings, CreateMessageRequest } from '../types';

const messages = new Hono<{ Bindings: Bindings }>();

// Create new message (no auth required)
messages.post('/create', async (c) => {
  try {
    const { event_id, user_name, message_text }: CreateMessageRequest = await c.req.json();
    
    if (!event_id || !message_text || !message_text.trim()) {
      return c.json({ error: 'Event ID and message text are required' }, 400);
    }

    const db = c.env.DB;

    // Verify event exists
    const event = await db.prepare(`
      SELECT id FROM events WHERE id = ?
    `).bind(event_id).first();

    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    // Insert message
    const result = await db.prepare(`
      INSERT INTO messages (event_id, user_name, message_text)
      VALUES (?, ?, ?)
    `).bind(event_id, user_name || null, message_text.trim()).run();

    return c.json({ 
      success: true,
      message: {
        id: result.meta.last_row_id,
        event_id,
        user_name: user_name || null,
        message_text: message_text.trim()
      }
    });
  } catch (error) {
    console.error('Create message error:', error);
    return c.json({ error: 'Failed to create message' }, 500);
  }
});

export default messages;
