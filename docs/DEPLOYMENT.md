# CareForAll - Deployment Guide

## Prerequisites

### On Your OVH VM:

1. **Docker & Docker Compose**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

2. **Git**
```bash
sudo apt update
sudo apt install git -y
```

3. **Open Required Ports**
```bash
# API Gateway
sudo ufw allow 3000/tcp

# Client Frontend
sudo ufw allow 4000/tcp

# Admin Dashboard
sudo ufw allow 4001/tcp

# PostgreSQL (if remote access needed)
sudo ufw allow 5432/tcp

# Redis (if remote access needed)
sudo ufw allow 6379/tcp

# Enable firewall
sudo ufw enable
```

---

## GitHub Repository Setup

### 1. Push Your Code to GitHub

```bash
cd /home/torr20/Documents/careforall

# Initialize git if not already
git init
git add .
git commit -m "Initial commit"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/careforall.git
git branch -M main
git push -u origin main
```

### 2. Configure GitHub Secrets

Go to your repository: **Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `SSH_HOST` | `your-vm-ip-address` | OVH VM IP (e.g., `51.178.x.x`) |
| `SSH_USER` | `root` or `ubuntu` | SSH username |
| `SSH_PRIVATE_KEY` | Your SSH private key | Full private key content |
| `REPO_URL` (optional) | `https://github.com/user/repo.git` | Git repository URL |

#### Getting Your SSH Private Key:

```bash
# On your local machine
cat ~/.ssh/id_rsa

# Copy the entire output including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ...content...
# -----END OPENSSH PRIVATE KEY-----
```

---

## Manual Deployment (First Time)

### Option 1: Using the Deployment Script

SSH into your OVH VM and run:

```bash
# Define variables
DEPLOY_DIR="/opt/careforall"
REPO_URL="https://github.com/YOUR_USERNAME/careforall.git"

# Clone repository
sudo mkdir -p /opt
cd /opt
sudo git clone "$REPO_URL" careforall
sudo chown -R $USER:$USER "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Create environment file
cp .env.example .env
nano .env  # Edit with your values

# Start services
docker compose up -d --build

# Check status
docker compose ps
docker compose logs
```

### Option 2: Step-by-Step Setup

```bash
# 1. Clone repository
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/careforall.git
cd careforall

# 2. Set ownership
sudo chown -R $USER:$USER /opt/careforall

# 3. Create .env file
cat > .env << 'EOF'
# Node Environment
NODE_ENV=production

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=careforall
DATABASE_URL=postgresql://postgres:your-secure-password@postgres:5432/careforall

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this

# Frontend URLs
NEXT_PUBLIC_API_URL=http://your-vm-ip:3000
FRONTEND_URL=http://your-vm-ip:4000

# SSL Commerz (use your production credentials)
SSLCOMMERZ_STORE_ID=your-store-id
SSLCOMMERZ_STORE_PASSWORD=your-store-password
SSLCOMMERZ_API_URL=https://securepay.sslcommerz.com
SSL_TEST_MODE=false

# Service URLs
API_GATEWAY_URL=http://api-gateway:3000
AUTH_SERVICE_URL=http://auth-service:3001
CAMPAIGN_SERVICE_URL=http://campaign-service:3002
PLEDGE_SERVICE_URL=http://pledge-service:3003
PAYMENT_SERVICE_URL=http://payment-service:3004
QUERY_SERVICE_URL=http://query-service:3005
ADMIN_SERVICE_URL=http://admin-service:3006
NOTIFICATION_SERVICE_URL=http://notification-service:3007
EOF

# 4. Start services
docker compose up -d --build

# 5. Initialize database (if needed)
docker exec careforall-postgres psql -U postgres -d careforall -f /docker-entrypoint-initdb.d/init-db.sql

# 6. Verify deployment
docker compose ps
docker compose logs --tail=50

# 7. Test endpoints
curl http://localhost:3000/health
curl http://localhost:4000
```

---

## Automated Deployment via GitHub Actions

Once configured, deployments happen automatically:

1. **Push to any branch** → Runs CI (tests, linting, builds)
2. **Push to main branch** → Runs CI + Deploys to OVH VM

### Workflow Steps:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Detect Changed Services/Frontends                    │
│    - Analyzes git diff                                   │
│    - Identifies which microservices changed             │
│    - Checks if shared package changed                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Build Docker Images (Parallel)                       │
│    - Builds only changed services                       │
│    - Tags with semantic version                         │
│    - Uploads artifacts                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Frontend CI (Parallel)                               │
│    - npm ci (fast, reliable install)                    │
│    - Run linting                                        │
│    - Run builds                                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Deploy to OVH VM (main branch only)                  │
│    - SSH into server                                    │
│    - Clone repo if first time                           │
│    - Pull latest changes                                │
│    - docker compose up -d --build                       │
│    - Clean up old images                                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Health Check                                         │
│    - Wait for services to start                         │
│    - Check API Gateway /health endpoint                 │
│    - Report deployment status                           │
└─────────────────────────────────────────────────────────┘
```

---

## Monitoring Deployment

### View GitHub Actions Logs:

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select the workflow run
4. View logs for each job

### SSH into VM and Check:

```bash
# SSH into server
ssh user@your-vm-ip

# Navigate to deployment directory
cd /opt/careforall

# Check running containers
docker compose ps

# View logs
docker compose logs -f

# Check specific service
docker compose logs -f api-gateway
docker compose logs -f payment-service

# Check resource usage
docker stats
```

---

## Troubleshooting

### Issue: Deployment fails with "Permission denied"

**Solution:** Add your SSH public key to VM

```bash
# On your local machine
cat ~/.ssh/id_rsa.pub

# On your VM
echo "your-public-key-here" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Issue: Docker not found on VM

**Solution:** Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Issue: Port already in use

**Solution:** Stop conflicting services

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or stop Docker containers
docker compose down
docker compose up -d
```

### Issue: Database connection failed

**Solution:** Check PostgreSQL container

```bash
# Check if postgres is running
docker compose ps postgres

# View postgres logs
docker compose logs postgres

# Restart postgres
docker compose restart postgres

# Connect to database
docker exec -it careforall-postgres psql -U postgres -d careforall
```

### Issue: Services not accessible from outside

**Solution:** Check firewall

```bash
# Allow required ports
sudo ufw allow 3000/tcp
sudo ufw allow 4000/tcp
sudo ufw allow 4001/tcp

# Check firewall status
sudo ufw status
```

---

## Rolling Back Deployment

### Option 1: Via Git

```bash
# On your VM
cd /opt/careforall

# Find previous commit
git log --oneline

# Reset to previous commit
git reset --hard <commit-hash>

# Rebuild
docker compose up -d --build
```

### Option 2: Via Docker

```bash
# Stop all services
docker compose down

# Pull previous images
docker compose pull

# Start services
docker compose up -d
```

---

## Updating Environment Variables

```bash
# SSH into VM
ssh user@your-vm-ip

# Navigate to project
cd /opt/careforall

# Edit .env file
nano .env

# Restart affected services
docker compose restart api-gateway
docker compose restart auth-service

# Or restart all services
docker compose down
docker compose up -d
```

---

## Database Backups

### Automated Backup Script:

```bash
#!/bin/bash
# /opt/careforall/scripts/backup-db.sh

BACKUP_DIR="/opt/backups/careforall"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/careforall_$DATE.sql"

mkdir -p $BACKUP_DIR

docker exec careforall-postgres pg_dump -U postgres careforall > $BACKUP_FILE

gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### Set up cron job:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/careforall/scripts/backup-db.sh
```

---

## Production Checklist

- [ ] Domain name configured and pointing to VM
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Firewall configured (only necessary ports open)
- [ ] Database backups automated
- [ ] Monitoring set up (Grafana/Prometheus)
- [ ] Log aggregation configured
- [ ] .env file contains production values
- [ ] SSL Commerz production credentials configured
- [ ] Email service configured (for notifications)
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] GitHub secrets configured
- [ ] SSH key-based authentication enabled
- [ ] Database password is strong
- [ ] JWT secrets are randomly generated

---

## Useful Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api-gateway

# Restart specific service
docker compose restart payment-service

# Rebuild specific service
docker compose up -d --build payment-service

# View resource usage
docker stats

# Clean up
docker system prune -a
docker volume prune

# Database shell
docker exec -it careforall-postgres psql -U postgres -d careforall

# Redis CLI
docker exec -it careforall-redis redis-cli

# Execute command in container
docker exec -it careforall-api-gateway sh
```

---

## Support & Maintenance

For issues and updates:
- GitHub Issues: https://github.com/YOUR_USERNAME/careforall/issues
- Documentation: `/docs` folder
- Database Schema: `/docs/DATABASE_SCHEMA.md`
- Architecture: `/docs/ARCHITECTURE.md`
