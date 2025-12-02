import { Hono } from 'hono';
import type { Bindings, CreateContributionRequest } from '../types';

const contributions = new Hono<{ Bindings: Bindings }>();

// Create new contribution (no auth required)
contributions.post('/create', async (c) => {
  try {
    const { event_id, contributor_name, amount }: CreateContributionRequest = await c.req.json();
    
    if (!event_id || !amount || amount <= 0) {
      return c.json({ error: 'Event ID and valid amount are required' }, 400);
    }

    const db = c.env.DB;

    // Verify event exists
    const event = await db.prepare(`
      SELECT id FROM events WHERE id = ?
    `).bind(event_id).first();

    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    // Insert contribution
    const result = await db.prepare(`
      INSERT INTO contributions (event_id, contributor_name, amount)
      VALUES (?, ?, ?)
    `).bind(event_id, contributor_name || null, amount).run();

    return c.json({ 
      success: true,
      contribution: {
        id: result.meta.last_row_id,
        event_id,
        contributor_name: contributor_name || null,
        amount
      }
    });
  } catch (error) {
    console.error('Create contribution error:', error);
    return c.json({ error: 'Failed to create contribution' }, 500);
  }
});

export default contributions;
