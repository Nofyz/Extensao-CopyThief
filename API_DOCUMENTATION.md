# CopyThief API Documentation

## Overview

The CopyThief API provides endpoints for managing social media content swipes, billing webhooks, database webhooks, and system health monitoring. All endpoints are built using Next.js App Router and follow RESTful conventions.

## Base URL

```
https://your-domain.com/api
```

## Authentication

The API uses **Supabase Auth** for authentication. Most endpoints require authentication and use the `enhanceRouteHandler` wrapper which automatically handles:

1. **Session Validation**: Verifies the user's session from Supabase Auth
2. **User Extraction**: Extracts the authenticated user object
3. **MFA Verification**: Checks if multi-factor authentication is required
4. **Automatic Redirects**: Redirects unauthenticated users to sign-in page

### Authentication Flow

```typescript
// The enhanceRouteHandler automatically handles authentication
export const POST = enhanceRouteHandler(
  async function ({ request, user }) {
    // user.id contains the authenticated user's ID
    // user object is available if auth: true (default)
  },
  {
    auth: true, // Requires authentication (default)
  },
);
```

### Account Association

The API supports two types of accounts:

#### 1. Personal Accounts (User-based)
- **Context**: `/dashboard/(user)/*`
- **Authentication**: Uses `user.id` from Supabase Auth
- **Data Association**: Swipes are linked to `user_id` field
- **Access Control**: Users can only access their own swipes

#### 2. Team Accounts (Account-based)  
- **Context**: `/dashboard/[account]/*`
- **Authentication**: Uses account slug from URL + user membership
- **Data Association**: Swipes are linked to `account_id` field
- **Access Control**: Team members can access swipes based on their role permissions

### Current Implementation

Currently, the swipes API uses **personal account authentication**:

```typescript
// In the swipes API route
const { data: swipe, error } = await supabase
  .from('swipes')
  .insert({
    user_id: user.id, // Links swipe to authenticated user
    // ... other fields
  });
```

### How Account Association Works

#### 1. Personal Account Swipes
- **Route**: `/api/swipes`
- **Context**: Personal user workspace (`/dashboard/(user)/*`)
- **Association**: Swipes are automatically linked to the authenticated user via `user_id`
- **Access**: Users can only see and manage their own swipes

#### 2. Team Account Swipes (Future Implementation)
- **Route**: `/dashboard/[account]/api/swipes` (not yet implemented)
- **Context**: Team account workspace (`/dashboard/[account]/*`)
- **Association**: Swipes would be linked to the team account via `account_id`
- **Access**: Team members can access swipes based on their role permissions

#### 3. Account Context Detection
The system determines the account context through:

1. **URL Path**: 
   - `/dashboard/(user)/*` → Personal account context
   - `/dashboard/[account]/*` → Team account context

2. **Workspace Context**:
   - `useUserWorkspace()` → Personal account data
   - `useTeamAccountWorkspace()` → Team account data

3. **Database Policies**:
   - Personal: `user_id = auth.uid()`
   - Team: `account_id = [account_id] AND has_role_on_account(account_id)`

### Row Level Security (RLS)

The database enforces security through RLS policies:

```sql
-- Users can only access their own swipes
CREATE POLICY "Users can view their own swipes" ON public.swipes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own swipes" ON public.swipes
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

### Headers Required

For authenticated endpoints, include your Supabase session:

```
Authorization: Bearer <supabase-session-token>
Content-Type: application/json
```

## Endpoints

### 1. Swipes API

The Swipes API allows users to create, retrieve, and delete social media content swipes.

#### Base Path: `/api/swipes`

#### POST /api/swipes
Create a new swipe entry.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "platform": "facebook" | "tiktok" | "google",
  "url": "string (required, valid URL)",
  "imageUrl": "string (optional, valid URL)",
  "videoUrl": "string (optional, valid URL)",
  "timestamp": "string (required, ISO datetime)",
  "tags": ["string"] (optional)
}
```

**Example Request:**
```json
{
  "title": "Amazing Facebook Ad",
  "description": "Great example of emotional marketing",
  "platform": "facebook",
  "url": "https://facebook.com/post/123",
  "imageUrl": "https://example.com/image.jpg",
  "timestamp": "2024-01-15T10:30:00Z",
  "tags": ["emotional", "marketing", "facebook"]
}
```

**Response (200):**
```json
{
  "success": true,
  "swipe": {
    "id": "uuid",
    "title": "Amazing Facebook Ad",
    "platform": "facebook",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (500):**
```json
{
  "error": "Failed to save swipe"
}
```

#### GET /api/swipes
Retrieve all swipes for the authenticated user.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "swipes": [
    {
      "id": "uuid",
      "title": "Amazing Facebook Ad",
      "description": "Great example of emotional marketing",
      "platform": "facebook",
      "thumbnail_url": "https://example.com/image.jpg",
      "source_url": "https://facebook.com/post/123",
      "metadata": {
        "tags": ["emotional", "marketing", "facebook"],
        "timestamp": "2024-01-15T10:30:00Z",
        "extension_version": "1.0.0"
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Error Response (500):**
```json
{
  "error": "Failed to fetch swipes"
}
```

#### DELETE /api/swipes
Delete multiple swipes by their IDs.

**Authentication:** Required

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Response (400):**
```json
{
  "error": "No IDs provided"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to delete swipes"
}
```

### 2. Billing Webhook API

#### Base Path: `/api/billing/webhook`

#### POST /api/billing/webhook
Handle webhook events from Stripe for billing operations.

**Authentication:** Not required (webhook endpoint)

**Headers:**
```
Content-Type: application/json
```

**Request Body:** Stripe webhook event payload

**Response (200):**
```
OK
```

**Error Response (500):**
```
Failed to process billing webhook
```

### 3. Database Webhook API

#### Base Path: `/api/db/webhook`

#### POST /api/db/webhook
Handle database webhook events from Supabase.

**Authentication:** Not required (webhook endpoint)

**Headers:**
```
Content-Type: application/json
X-Supabase-Event-Signature: <signature>
```

**Request Body:** Supabase webhook event payload

**Response (200):**
```
null
```

**Error Response (400):**
```
Missing signature
```

**Error Response (500):**
```
null
```

### 4. Authentication API

#### Base Path: `/api/auth`

#### POST /api/auth/login
Authenticate user with email and password, returning session tokens.

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_at": 1734567890
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Credenciais inválidas"
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Authentication:** Not required

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "last_sign_in_at": "2024-01-15T10:30:00Z"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_at": 1734567890,
      "expires_in": 3600
    },
    "config": {
      "supabase_url": "https://your-project.supabase.co"
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Token de refresh inválido ou expirado"
}
```

#### POST /api/auth/logout
Logout the authenticated user.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

#### GET /api/auth/me
Get current user session information.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "last_sign_in_at": "2024-01-15T10:30:00Z"
    },
    "session": {
      "expires_at": 1734567890,
      "is_expired": false
    }
  }
}
```

### 5. System Health API

#### Base Path: `/healthcheck`

#### GET /healthcheck
Check the health status of the application and its services.

**Authentication:** Not required

**Response (200):**
```json
{
  "services": {
    "database": true
  }
}
```

### 6. Version API

#### Base Path: `/version`

#### GET /version
Get the current version/git hash of the application.

**Authentication:** Not required

**Response (200):**
```
a1b2c3d
```

### 7. Chat Response API

#### Base Path: `/dashboard/[account]/chat/[referenceId]/respond`

#### POST /dashboard/[account]/chat/[referenceId]/respond
Stream chat responses using LLM service.

**Authentication:** Required

**Path Parameters:**
- `account`: Account identifier
- `referenceId`: Chat reference identifier

**Request Body:** StreamResponseSchema (defined in chat-llm.service)

**Response:** Streaming response from LLM service

**Error Response (500):**
```
Error message
```

## Data Models

### Swipe Schema

```typescript
interface Swipe {
  id: string;
  title: string;
  description?: string;
  platform: 'facebook' | 'tiktok' | 'google';
  url: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp: string;
  tags?: string[];
}
```

### Swipe Database Model

```typescript
interface SwipeRecord {
  id: string;
  user_id: string;           // Links to authenticated user (personal accounts)
  account_id?: string;       // Links to team account (team accounts)
  title: string;
  description?: string;
  platform: string;
  source_url: string;
  thumbnail_url?: string;
  metadata: {
    tags: string[];
    timestamp: string;
    extension_version: string;
  };
  created_at: string;
  updated_at: string;
}
```

### Account Context Models

#### Personal Account Context
```typescript
interface UserWorkspace {
  accounts: Array<{
    label: string | null;
    value: string | null;
    image: string | null;
  }>;
  workspace: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
    subscription_status: string | null;
  };
  user: User; // Supabase Auth User
}
```

#### Team Account Context
```typescript
interface TeamAccountWorkspace {
  accounts: Array<{
    id: string;
    name: string;
    picture_url: string | null;
    slug: string;
    role: string;
  }>;
  account: {
    id: string;
    name: string;
    picture_url: string | null;
    slug: string;
    role: string;
    role_hierarchy_level: number;
    primary_owner_user_id: string;
    subscription_status: string | null;
    permissions: string[];
  };
  user: User; // Supabase Auth User
}
```

## Error Handling

All API endpoints follow a consistent error handling pattern:

- **400 Bad Request**: Invalid request data or missing required fields
- **401 Unauthorized**: Missing or invalid authentication
- **500 Internal Server Error**: Server-side errors

Error responses typically include an `error` field with a descriptive message:

```json
{
  "error": "Descriptive error message"
}
```

## Rate Limiting

Currently, no explicit rate limiting is implemented. Consider implementing rate limiting for production use.

## Token Management

### Access Token vs Refresh Token

- **Access Token**: Short-lived token (typically 1 hour) used for API authentication
- **Refresh Token**: Long-lived token (typically 30 days) used to obtain new access tokens

### How to Use Refresh Tokens

1. **Store both tokens securely** after login
2. **Use access token** for API requests
3. **When access token expires** (401 Unauthorized response), use refresh token to get a new one
4. **Replace old tokens** with new ones from refresh response

### Example Token Refresh Flow

```bash
#!/bin/bash

# 1. Login and store tokens
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}')

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.session.access_token')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.session.refresh_token')

# 2. Use access token for API calls
API_RESPONSE=$(curl -s -X GET http://localhost:3001/api/swipes \
  -H "Authorization: Bearer $ACCESS_TOKEN")

# 3. If you get 401, refresh the token
if echo "$API_RESPONSE" | grep -q "401"; then
  echo "Token expired, refreshing..."
  
  REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}")
  
  NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.session.access_token')
  NEW_REFRESH_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.session.refresh_token')
  
  # 4. Retry API call with new token
  API_RESPONSE=$(curl -s -X GET http://localhost:3001/api/swipes \
    -H "Authorization: Bearer $NEW_ACCESS_TOKEN")
fi

echo "$API_RESPONSE"
```

### Token Expiration Handling

- **Access tokens expire** after 1 hour (3600 seconds)
- **Refresh tokens expire** after 30 days
- **Always check `expires_at`** field in login/refresh responses
- **Implement automatic refresh** in your client applications

## Security Considerations

1. **Authentication**: Most endpoints require valid Supabase Auth session tokens
2. **Row Level Security (RLS)**: Database operations are protected by RLS policies that ensure users can only access their own data
3. **Input Validation**: All inputs are validated using Zod schemas before processing
4. **Webhook Signatures**: Webhook endpoints verify signatures for security
5. **Account Isolation**: Personal and team accounts are completely isolated
6. **Permission-based Access**: Team accounts use role-based permissions for access control
7. **Session Management**: Automatic session validation and MFA enforcement
8. **CSRF Protection**: Middleware provides CSRF protection for mutating requests
9. **Token Security**: Store tokens securely, never expose refresh tokens in client-side code

## Development

### Local Development

To run the API locally:

```bash
cd apps/web
npm run dev
```

The API will be available at `http://localhost:3000/api`

### Testing

API endpoints can be tested using tools like:
- Postman
- curl
- Thunder Client (VS Code extension)

### Example curl Commands

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Refresh Token:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

**Check session:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <supabase-session-token>"
```

**Logout:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <supabase-session-token>"
```

**Create a swipe:**
```bash
curl -X POST http://localhost:3000/api/swipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-session-token>" \
  -d '{
    "title": "Test Swipe",
    "platform": "facebook",
    "url": "https://facebook.com/test",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

**Get all swipes (personal account):**
```bash
curl -X GET http://localhost:3000/api/swipes \
  -H "Authorization: Bearer <supabase-session-token>"
```

**Get swipes for team account:**
```bash
# Team account swipes would be accessed through the dashboard context
# /dashboard/[account]/swipes - not directly via API
```



**Health check:**
```bash
curl -X GET http://localhost:3000/healthcheck
```

## Changelog

### Version 1.0.0
- Initial API implementation
- Swipes CRUD operations
- Billing webhook support
- Database webhook support
- Health check endpoint
- Version endpoint
- Chat response streaming 