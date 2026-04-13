# Deployment Guide — Chat Feature & WebSocket Configuration

## Overview
The chat system has been fully implemented with real-time features including file uploads, message replies, edit/delete, typing indicators, and presence. The deployment requires both frontend and backend configuration.

## Issues Fixed

### 1. WebSocket Proxy Configuration ✅
**Issue**: WebSocket connections were failing (ERR_NAME_NOT_RESOLVED)

**Root Cause**: The nginx configuration was missing WebSocket upgrade headers

**Fix**: Updated `nginx.conf.template` to include:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400s;  # Keep connections alive for 24 hours
```

**Status**: ✅ Fixed in commit `def40fb`

## Deployment Checklist

### Backend (Railway or other host)

#### 1. Environment Variables
The backend requires these environment variables to be set:
```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=<32+ character secret>
JWT_REFRESH_SECRET=<32+ character secret>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
PORT=8000
HOST=0.0.0.0
CORS_ORIGIN=<comma-separated frontend URLs>
NODE_ENV=production

# Optional: R2/S3 storage for file uploads
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<cloudflare-api-token>
R2_SECRET_ACCESS_KEY=<cloudflare-api-secret>
R2_BUCKET=kort-storage
```

#### 2. Database Migrations
The server automatically applies migrations on startup via `pnpm run start:docker`:
1. Connects to DATABASE_URL
2. Checks for failed migrations (has recovery logic)
3. Applies pending migrations
4. Seeds demo data (idempotent)
5. Starts the server

**Verify migrations applied**:
```bash
pnpm run db:status
```

#### 3. Server Health Check
After deployment, verify the backend is running:
```bash
curl https://your-backend.com/healthz
# Should return: 200 ok
```

#### 4. WebSocket Connection
Test WebSocket endpoint (requires valid JWT token):
```bash
# Get token from browser console after login
TOKEN="<your-jwt-token>"
wscat -c "wss://your-backend.com/api/v1/ws/chat?token=$TOKEN"
# Should see: {"type":"connected","user_id":"..."}
```

### Frontend (Railway or Vercel)

#### 1. Build Environment Variable
Set during build:
```
VITE_API_BASE_URL=https://your-backend.com/api/v1
```

If not set, frontend defaults to `/api/v1` (relative proxy through nginx).

#### 2. Build Command
```bash
pnpm install
pnpm run build
```

#### 3. Docker Deployment
The frontend uses nginx to serve the app and proxy API requests:
```
BACKEND_URL=https://your-backend.com/api/v1 \
PORT=3000 \
docker build -t kort-frontend .
```

### Railway-Specific Configuration

#### For Backend Service:
1. **Builder**: Docker
2. **Dockerfile**: `server/Dockerfile`
3. **Environment Variables**: Set all backend vars above
4. **Port**: 8000
5. **Health Check**: `/healthz`

#### For Frontend Service:
1. **Builder**: Docker
2. **Dockerfile**: `Dockerfile` (in repo root)
3. **Build Variables**: `VITE_API_BASE_URL=https://<backend-service>.railway.app/api/v1`
4. **Environment Variables**: `BACKEND_URL=https://<backend-service>.railway.app/api/v1`
5. **Port**: 80

#### Cross-Service Communication:
In Railway, use the internal service URL within the project:
- Backend → Frontend not needed
- Frontend → Backend: Use `RAILWAY_PRIVATE_DOMAIN` or public URL

## Troubleshooting

### WebSocket Connections Fail
**Symptom**: Browser console shows `ERR_NAME_NOT_RESOLVED` or connection timeout

**Causes**:
1. ❌ nginx missing upgrade headers (fixed in v1)
2. ❌ BACKEND_URL points to wrong service
3. ❌ Backend not running or firewall blocks port 8000

**Fix**:
1. Verify nginx.conf.template has upgrade headers (see above)
2. Check BACKEND_URL matches backend service URL
3. Test `curl https://backend/healthz`

### 401 Unauthorized Errors
**Symptom**: API calls return 401, chat endpoints fail

**Causes**:
1. ❌ JWT_ACCESS_SECRET not set on deployed backend
2. ❌ Token expired (> 15 minutes old)
3. ❌ Token not being sent in Authorization header

**Fix**:
1. Set JWT_ACCESS_SECRET in environment (min 16 chars)
2. Check browser localStorage: `useAuthStore` should have token
3. Check browser DevTools Network tab: Authorization header present?

### 500 Internal Server Error
**Symptom**: `/api/v1/chat/conversations` returns 500

**Causes**:
1. ❌ Database migrations not applied
2. ❌ DATABASE_URL incorrect or unreachable
3. ❌ Chat tables missing from schema

**Fix**:
1. SSH to backend and run: `pnpm run db:status`
2. Check migrations: `pnpm run db:migrate` (if needed)
3. Verify database connection string
4. Check server logs for SQL errors

### File Upload Fails
**Symptom**: Attachment upload returns 400 or 500

**Causes**:
1. ❌ R2 credentials not configured
2. ❌ File too large (max 10MB default)
3. ❌ MIME type not allowed

**Fix**:
1. Set R2_* environment variables
2. Check UPLOAD_MAX_FILE_SIZE_MB setting
3. Allowed: images, PDF, Excel, Word docs

## Architecture

```
Frontend (nginx + SPA)
    ↓ /api/* proxy
Backend (Fastify + Node.js)
    ↓ HTTP
    ↓ WebSocket
    ↓
Database (PostgreSQL)
    ↓
File Storage (Cloudflare R2)
```

## Features Implemented

✅ Text messages with real-time delivery  
✅ File attachments (images, documents)  
✅ Message replies with quote preview  
✅ Edit/delete messages (24h window)  
✅ Read receipts (✓✓ checkmarks)  
✅ Typing indicators  
✅ Online presence  
✅ Desktop notifications  
✅ Order card sharing  
✅ Conversation search  
✅ Message skeleton loading  

## Next Steps

1. **Deploy Backend** with all environment variables
2. **Verify Migrations** applied to production database
3. **Deploy Frontend** with correct VITE_API_BASE_URL
4. **Test Chat** in production:
   - Send message
   - See real-time delivery
   - Test WebSocket reconnection
   - Verify file upload
5. **Monitor** server logs for errors

## Related Files

- Backend: `server/src/modules/chat/`
- Frontend: `src/features/chat/`
- Nginx config: `nginx.conf.template`
- Docker: `Dockerfile`, `server/Dockerfile`
- Database: `server/prisma/migrations/20260401000000_add_chat/`
