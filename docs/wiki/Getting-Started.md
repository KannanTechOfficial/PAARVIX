# Getting Started with OmniViz

Deploy OmniViz in less than 2 minutes using Docker Compose or native scripts.

---

## 💻 Hardware Requirements

| Resource | Minimum (Community) | Recommended (Enterprise) |
|---|---|---|
| **RAM** | **2 GB** (idle < 512 MB) | 8 GB - 16 GB |
| **CPU** | **1 vCPU** | 4 - 8 vCPUs |
| **Storage** | 10 GB SSD | 100 GB NVMe |
| **OS** | Linux (Ubuntu, Debian, Fedora), macOS, Windows WSL2 | Linux (Ubuntu 24.04 LTS) |

---

## 🚀 One-Command Quickstart

Clone the repository and run the automated installation script:

```bash
git clone -b Canary https://github.com/KannanTechOfficial/omniviz.git
cd omniviz
./install.sh
```

The script will automatically:
1. Verify Docker and Docker Compose prerequisites.
2. Generate secure cryptographically random secrets for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `PAARVIX_ENCRYPTION_KEY` in `.env`.
3. Spin up PostgreSQL, the NestJS Fastify backend API, and the Angular 22 frontend stack.
4. Output access URLs and initial credentials.

---

## 🌐 Accessing the Platform

* **Frontend Web App:** `http://localhost:4200`
* **Backend API Gateway:** `http://localhost:3000/api`
* **API Health Check:** `http://localhost:3000/api/health`

### Initial Administrator Login:
* **Email:** `admin@kannantech.com`
* **Password:** `paarvixAdmin2026!` *(Please change immediately in Settings upon first login)*

---

## 🛑 Stopping & Restarting

```bash
# Stop the stack
./run.sh stop

# Start the stack
./run.sh start

# View live container logs
./run.sh logs
```
