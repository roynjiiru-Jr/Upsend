import { Hono } from 'hono';
import type { Bindings, CreateEventRequest, Event } from '../types';
import { requireAuth, getCurrentUser, generateShareableCode } from '../utils/auth';

const events = new Hono<{ Bindings: Bindings }>();

// Create new event (requires auth)
events.post('/create', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { title, description, event_date, cover_image }: CreateEventRequest = await c.req.json();
    
    if (!title || !event_date) {
      return c.json({ error: 'Title and event date are required' }, 400);
    }

    const db = c.env.DB;
    
    // Generate unique shareable link
    let shareableLink = '';
    let isUnique = false;
    
    while (!isUnique) {
      shareableLink = generateShareableCode(8);
      const existing = await db.prepare(`
        SELECT id FROM events WHERE shareable_link = ?
      `).bind(shareableLink).first();
      
      if (!existing) {
        isUnique = true;
      }
    }

    // Insert event
    const result = await db.prepare(`
      INSERT INTO events (user_id, title, description, event_date, cover_image, shareable_link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(user.id, title, description || null, event_date, cover_image || null, shareableLink).run();

    const eventId = result.meta.last_row_id;

    return c.json({ 
      success: true,
      event: {
        id: eventId,
        user_id: user.id,
        title,
        description: description || null,
        event_date,
        cover_image: cover_image || null,
        shareable_link: shareableLink
      }
    });
  } catch (error) {
    console.error('Create event error:', error);
    return c.json({ error: 'Failed to create event' }, 500);
  }
});

// Get public event details (no auth required)
events.get('/:shareableLink', async (c) => {
  try {
    const shareableLink = c.req.param('shareableLink');
    const db = c.env.DB;

    // Get event details
    const event = await db.prepare(`
      SELECT e.*, u.name as creator_name
      FROM events e
      JOIN users u ON e.user_id = u.id
      WHERE e.shareable_link = ?
    `).bind(shareableLink).first();

    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    // Get public messages (no timestamps)
    const messagesResult = await db.prepare(`
      SELECT id, user_name, message_text
      FROM messages
      WHERE event_id = ?
      ORDER BY created_at DESC
    `).bind(event.id).all();

    return c.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        cover_image: event.cover_image,
        creator_name: event.creator_name
      },
      messages: messagesResult.results || []
    });
  } catch (error) {
    console.error('Get event error:', error);
    return c.json({ error: 'Failed to get event' }, 500);
  }
});

// Get all events for current user (requires auth)
events.get('/creator/list', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    const eventsResult = await db.prepare(`
      SELECT 
        e.*,
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT c.id) as contribution_count,
        COALESCE(SUM(c.amount), 0) as total_contributions
      FROM events e
      LEFT JOIN messages m ON e.id = m.event_id
      LEFT JOIN contributions c ON e.id = c.event_id
      WHERE e.user_id = ?
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `).bind(user.id).all();

    return c.json({ 
      events: eventsResult.results || []
    });
  } catch (error) {
    console.error('Get creator events error:', error);
    return c.json({ error: 'Failed to get events' }, 500);
  }
});

// Get detailed event info for creator (includes contributions)
events.get('/creator/:eventId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const eventId = c.req.param('eventId');
    const db = c.env.DB;

    // Verify ownership
    const event = await db.prepare(`
      SELECT * FROM events WHERE id = ? AND user_id = ?
    `).bind(eventId, user.id).first();

    if (!event) {
      return c.json({ error: 'Event not found or unauthorized' }, 404);
    }

    // Get messages
    const messagesResult = await db.prepare(`
      SELECT id, user_name, message_text, created_at
      FROM messages
      WHERE event_id = ?
      ORDER BY created_at DESC
    `).bind(eventId).all();

    // Get contributions (private to creator)
    const contributionsResult = await db.prepare(`
      SELECT id, contributor_name, amount, created_at
      FROM contributions
      WHERE event_id = ?
      ORDER BY created_at DESC
    `).bind(eventId).all();

    // Calculate total
    const totalResult = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM contributions
      WHERE event_id = ?
    `).bind(eventId).first();

    return c.json({
      event,
      messages: messagesResult.results || [],
      contributions: contributionsResult.results || [],
      total_contributions: totalResult?.total || 0
    });
  } catch (error) {
    console.error('Get creator event details error:', error);
    return c.json({ error: 'Failed to get event details' }, 500);
  }
});

export default events;
