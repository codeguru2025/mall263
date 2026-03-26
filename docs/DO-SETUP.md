# DigitalOcean Infrastructure Setup for Mall263

This guide walks you through creating all required DigitalOcean resources.

---

## 1. Managed PostgreSQL Database

### Create via DO Console
1. Go to **Databases** → **Create Database Cluster**
2. Settings:
   - **Engine:** PostgreSQL 16
   - **Region:** Pick closest to your users (e.g. `lon1` for Africa-facing, or `nyc3`)
   - **Plan:** Basic → $15/mo (1 vCPU, 1GB RAM, 10GB disk) for dev; scale later
   - **Database name:** `mall263`
   - **Cluster name:** `mall263-db`
3. After creation, go to **Connection Details** and copy the connection string
4. It will look like:
   ```
   postgresql://doadmin:PASSWORD@mall263-db-do-user-XXXXX.db.ondigitalocean.com:25060/mall263?sslmode=require
   ```
5. Add this as `DATABASE_URL` in your `.env`

### Secure it
- Under **Settings** → **Trusted Sources**, add your Droplet/App Platform IP
- This blocks public access

---

## 2. Managed Redis

### Create via DO Console
1. Go to **Databases** → **Create Database Cluster**
2. Settings:
   - **Engine:** Redis 7
   - **Region:** Same as PostgreSQL
   - **Plan:** Basic → $15/mo (1 vCPU, 1GB RAM)
   - **Cluster name:** `mall263-redis`
3. After creation, copy the connection details:
   - **Host:** `mall263-redis-do-user-XXXXX.db.ondigitalocean.com`
   - **Port:** `25061`
   - **Password:** (shown in connection details)
4. Add to `.env`:
   ```
   REDIS_HOST=mall263-redis-do-user-XXXXX.db.ondigitalocean.com
   REDIS_PORT=25061
   REDIS_PASSWORD=your-redis-password
   ```

### Note on Redis TLS
DO Managed Redis uses TLS by default on port 25061. If the `ioredis` client needs TLS:
```ts
// In redis.service.ts, the connection already supports password auth.
// For TLS, you may need to add: tls: {} to the Redis options
```

---

## 3. Spaces (Object Storage / S3-Compatible)

### Create the Bucket
1. Go to **Spaces Object Storage** → **Create a Space**
2. Settings:
   - **Region:** `nyc3` (or your preferred region)
   - **CDN:** ✅ Enable (gives you a CDN URL for fast global delivery)
   - **File Listing:** ❌ Restrict (keep private listing)
   - **Space name:** `mall263-uploads`
3. Your Space URL will be: `https://mall263-uploads.nyc3.digitaloceanspaces.com`
4. CDN URL will be: `https://mall263-uploads.nyc3.cdn.digitaloceanspaces.com`

### Create API Keys
1. Go to **API** (left sidebar) → **Spaces Keys**
2. Click **Generate New Key**
3. Name it: `mall263-backend`
4. Copy the **Key** and **Secret** (secret only shown once!)
5. Add to `.env`:
   ```
   DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
   DO_SPACES_BUCKET=mall263-uploads
   DO_SPACES_REGION=nyc3
   DO_SPACES_ACCESS_KEY=your-access-key
   DO_SPACES_SECRET_KEY=your-secret-key
   DO_SPACES_CDN_URL=https://mall263-uploads.nyc3.cdn.digitaloceanspaces.com
   ```

### CORS Configuration
In your Space settings, add CORS rules:
- **Origin:** `*` (or your specific domain)
- **Allowed Methods:** `GET, PUT`
- **Allowed Headers:** `*`
- **Max Age:** `3600`

---

## 4. Droplet (Optional — for Docker deployment)

If deploying with Docker Compose instead of App Platform:

1. Go to **Droplets** → **Create Droplet**
2. Settings:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic → $12/mo (2 vCPU, 2GB RAM) minimum
   - **Region:** Same as databases
   - **Auth:** SSH key (recommended)
3. After creation, SSH in and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo apt install docker-compose-plugin -y
   ```
4. Clone your repo and deploy:
   ```bash
   git clone https://github.com/your-org/mall263.git
   cd mall263
   cp .env.production .env
   # Edit .env with your actual DO credentials
   docker compose -f docker-compose.prod.yml up -d
   ```

---

## 5. Complete .env for Production

Generate secure JWT secrets:
```bash
openssl rand -hex 32  # for JWT_SECRET
openssl rand -hex 32  # for JWT_REFRESH_SECRET
```

Your final `.env` should look like:
```env
DATABASE_URL=postgresql://doadmin:PASS@host:25060/mall263?sslmode=require
REDIS_HOST=your-redis-host.db.ondigitalocean.com
REDIS_PORT=25061
REDIS_PASSWORD=your-redis-password
JWT_SECRET=generated-hex-string
JWT_REFRESH_SECRET=generated-hex-string
MEILISEARCH_API_KEY=generated-strong-key
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=mall263-uploads
DO_SPACES_REGION=nyc3
DO_SPACES_ACCESS_KEY=your-key
DO_SPACES_SECRET_KEY=your-secret
DO_SPACES_CDN_URL=https://mall263-uploads.nyc3.cdn.digitaloceanspaces.com
FRONTEND_URL=https://mall263.co.zw
```

---

## 6. After Setup — Run Migrations

Once your database is live:
```bash
# From backend directory
DATABASE_URL="your-do-connection-string" npx prisma migrate deploy
DATABASE_URL="your-do-connection-string" npx ts-node prisma/seed.ts
```

---

## Cost Estimate (Monthly)

| Service              | Plan          | Cost    |
|----------------------|---------------|---------|
| Managed PostgreSQL   | Basic 1GB     | $15/mo  |
| Managed Redis        | Basic 1GB     | $15/mo  |
| Spaces (250GB)       | Standard      | $5/mo   |
| Spaces CDN           | Included      | $0      |
| Droplet (optional)   | Basic 2GB     | $12/mo  |
| **Total**            |               | **$35-47/mo** |

---

## File Upload Endpoints (Backend API)

Once deployed, the upload API is available at:

| Endpoint               | Method | Description              | Max Size |
|------------------------|--------|--------------------------|----------|
| `/api/v1/upload/image`    | POST   | Single product image     | 5MB      |
| `/api/v1/upload/images`   | POST   | Multiple images (up to 5)| 5MB each |
| `/api/v1/upload/avatar`   | POST   | User avatar (400x400)    | 2MB      |
| `/api/v1/upload/document` | POST   | Document/PDF upload      | 10MB     |
| `/api/v1/upload/:key`     | DELETE | Delete a file by key     | —        |

All image uploads are auto-optimized to WebP format via Sharp.
