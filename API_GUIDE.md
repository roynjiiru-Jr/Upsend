# Upsend API Quick Start Guide

## Base URL
Development: http://localhost:3000
Production: https://3000-iq0e39r6vo8zty1vg7jfx-dfc00ec5.sandbox.novita.ai

## Complete User Flow Example

### 1. Sign Up / Sign In
```bash
# Request magic link
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe"
  }'

# Response:
{
  "success": true,
  "message": "Magic link sent to your email",
  "dev_token": "abc123...",  # For MVP testing only
  "dev_link": "/auth/verify?token=abc123..."
}
```

### 2. Verify Magic Link
```bash
# Verify the token
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123..."
  }'

# Response:
{
  "success": true,
  "session_token": "xyz789...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}

# Save the session_token for authenticated requests
```

### 3. Create an Event (Authenticated)
```bash
curl -X POST http://localhost:3000/api/events/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer xyz789..." \
  -d '{
    "title": "My 30th Birthday Party",
    "description": "Join me for an amazing celebration!",
    "event_date": "2025-12-25",
    "cover_image": "https://example.com/party.jpg"
  }'

# Response:
{
  "success": true,
  "event": {
    "id": 1,
    "user_id": 1,
    "title": "My 30th Birthday Party",
    "description": "Join me for an amazing celebration!",
    "event_date": "2025-12-25",
    "cover_image": "https://example.com/party.jpg",
    "shareable_link": "abc12345"
  }
}

# Share this URL: http://localhost:3000/event/abc12345
```

### 4. Guest Leaves a Message (No Auth Required)
```bash
curl -X POST http://localhost:3000/api/messages/create \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "user_name": "Sarah Johnson",
    "message_text": "Happy Birthday! Cant wait to celebrate with you!"
  }'

# Response:
{
  "success": true,
  "message": {
    "id": 1,
    "event_id": 1,
    "user_name": "Sarah Johnson",
    "message_text": "Happy Birthday! Cant wait to celebrate with you!"
  }
}
```

### 5. Guest Makes a Contribution (No Auth Required)
```bash
curl -X POST http://localhost:3000/api/contributions/create \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "contributor_name": "Mike Chen",
    "amount": 50.00
  }'

# Response:
{
  "success": true,
  "contribution": {
    "id": 1,
    "event_id": 1,
    "contributor_name": "Mike Chen",
    "amount": 50
  }
}
```

### 6. View Public Event Page (No Auth Required)
```bash
curl http://localhost:3000/api/events/abc12345

# Response:
{
  "event": {
    "id": 1,
    "title": "My 30th Birthday Party",
    "description": "Join me for an amazing celebration!",
    "event_date": "2025-12-25",
    "cover_image": "https://example.com/party.jpg",
    "creator_name": "John Doe"
  },
  "messages": [
    {
      "id": 1,
      "user_name": "Sarah Johnson",
      "message_text": "Happy Birthday! Cant wait to celebrate with you!"
      # Note: No timestamp shown to public
    }
  ]
}
```

### 7. Creator Views Event Details (Authenticated)
```bash
curl http://localhost:3000/api/events/creator/1 \
  -H "Authorization: Bearer xyz789..."

# Response:
{
  "event": {
    "id": 1,
    "user_id": 1,
    "title": "My 30th Birthday Party",
    "description": "Join me for an amazing celebration!",
    "event_date": "2025-12-25",
    "cover_image": "https://example.com/party.jpg",
    "shareable_link": "abc12345",
    "created_at": 1734912000
  },
  "messages": [
    {
      "id": 1,
      "user_name": "Sarah Johnson",
      "message_text": "Happy Birthday! Cant wait to celebrate with you!",
      "created_at": 1734912060  # Timestamp visible to creator
    }
  ],
  "contributions": [
    {
      "id": 1,
      "contributor_name": "Mike Chen",
      "amount": 50,
      "created_at": 1734912120  # Private to creator only
    }
  ],
  "total_contributions": 50
}
```

### 8. Creator Views All Events (Authenticated)
```bash
curl http://localhost:3000/api/events/creator/list \
  -H "Authorization: Bearer xyz789..."

# Response:
{
  "events": [
    {
      "id": 1,
      "user_id": 1,
      "title": "My 30th Birthday Party",
      "description": "Join me for an amazing celebration!",
      "event_date": "2025-12-25",
      "cover_image": "https://example.com/party.jpg",
      "shareable_link": "abc12345",
      "created_at": 1734912000,
      "message_count": 5,
      "contribution_count": 3,
      "total_contributions": 150
    }
  ]
}
```

### 9. Check Current User (Authenticated)
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer xyz789..."

# Response:
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### 10. Logout (Authenticated)
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer xyz789..."

# Response:
{
  "success": true
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (invalid or expired session)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Authentication

Use the session token in the Authorization header:
```
Authorization: Bearer YOUR_SESSION_TOKEN
```

Or as a cookie:
```
Cookie: session_token=YOUR_SESSION_TOKEN
```

Session tokens are valid for 30 days.
Magic link tokens expire after 15 minutes.

## Rate Limiting

Currently no rate limiting in MVP. 
Implement rate limiting before production deployment.

## Testing Tips

1. Use the dev_token from magic-link response for quick testing
2. Save session_token for subsequent authenticated requests
3. Test with different user accounts to verify privacy features
4. Verify contributions are hidden from public API responses
5. Check that timestamps are hidden from public message views

## Frontend URLs

- `/` - Landing page
- `/auth` - Sign in / Sign up
- `/dashboard` - Creator dashboard (requires auth)
- `/create-event` - Create new event (requires auth)
- `/event/:shareableLink` - Public event page
- `/event-details/:eventId` - Creator event details (requires auth)
