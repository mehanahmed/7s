# Deployment Guide: Next.js on CyberPanel

This guide provides step-by-step instructions for deploying this Next.js application to a CyberPanel-managed server.

## 1. Prerequisites

- A server with **CyberPanel** installed.
- **Node.js** and **npm/pnpm** installed on the server.
- **MySQL** database created via CyberPanel.
- Domain or Subdomain pointed to your server's IP.

---

## 2. Server Setup

### A. Create Website in CyberPanel
1. Log in to CyberPanel.
2. Go to **Websites** > **Create Website**.
3. Fill in your domain details and select **PHP 8.1+** (even though we use Node.js, this sets up the vhost).

### B. Install Node.js
If not already installed, run via SSH:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 3. Application Deployment

### A. Clone Repository
SSH into your server and navigate to your website's directory:
```bash
cd /home/yourdomain.com/public_html
git clone https://github.com/princeshiamofficial/erp-migrated.git .
```

### B. Environment Configuration
Create a `.env` file in the root directory:
```bash
nano .env
```
Add your production variables (MySQL credentials, Socket.IO URLs, etc.):
```env
DATABASE_URL="mysql://user:password@localhost:3306/db_name"
NEXT_PUBLIC_SOCKET_URL="https://yourdomain.com"
# Add other necessary keys here
```

### C. Install & Build
```bash
npm install
npm run build
```

---

## 4. Reverse Proxy Setup (OpenLiteSpeed)

CyberPanel uses OpenLiteSpeed. To route traffic from Port 80/443 to your Node.js app (default port 3000):

1. Go to **Websites** > **List Websites** > **Manage** (for your domain).
2. Click on **vHost Conf**.
3. Add the following at the bottom (replace `3000` with your app port):

```apache
extprocessor nodejs {
  type                    proxy
  address                 127.0.0.1:3000
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 nodejs
  addDefaultCharset       off
}
```
4. **Save** and restart OpenLiteSpeed.

---

## 5. Process Management (PM2)

To ensure the application stays running after you close the SSH session:

1. Install PM2:
   ```bash
   npm install pm2 -g
   ```
2. Start the application:
   ```bash
   pm2 start npm --name "erp-app" -- start
   ```
3. Setup auto-restart on reboot:
   ```bash
   pm2 save
   pm2 startup
   ```

---

## 6. Real-Time (Socket.IO) Considerations

CyberPanel/OpenLiteSpeed requires WebSockets to be enabled:
1. In the **vHost Conf**, ensure `WebSocket Proxy` is configured if you encounter connection issues.
2. Ensure your `NEXT_PUBLIC_SOCKET_URL` uses `https://` if SSL is enabled.

---

## 7. Troubleshooting

- **503 Service Unavailable**: Usually means the Node.js process isn't running (`pm2 status`) or the port in vHost Conf doesn't match the app port.
- **Permissions**: Ensure files are owned by the website user: 
  `chown -R user:user /home/yourdomain.com/public_html`
# 7s
