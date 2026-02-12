# Hostinger Node.js Deployment — Findings & Workarounds

> Last updated: 2026-02-12
> Server: `lightpink-lark-246190.hostingersite.com`
> Platform: Hostinger Shared Hosting (CloudLinux 8, LiteSpeed)
> Node Version: 22.x (via LiteSpeed Node.js handler)

---

## Architecture Overview

Hostinger runs Node.js apps through **LiteSpeed Web Server** using its built-in Node.js handler (`lsnode.js`). This creates a unique environment with several quirks compared to traditional Node.js hosting (e.g., Heroku, Railway, DigitalOcean).

### Key Components
- **Build Environment**: Where `npm install` and `postinstall` scripts run during deployment
- **Runtime Environment**: Where `node src/server.js` actually runs (via LiteSpeed)
- **SSH Environment**: Where you connect via `ssh hostinger` — a **separate context** from both build and runtime

---

## ❗ Critical Findings

### 1. `npx` is NOT available — anywhere
**Problem**: `npx` is not in the system PATH in any environment (build, runtime, SSH).

**Workaround**: Use the local binary path directly:
```bash
# Instead of:
npx prisma db push

# Use:
./node_modules/.bin/prisma db push
```

### 2. `node` is NOT in the runtime PATH
**Problem**: The LiteSpeed Node.js handler runs your app using its own internal Node.js binary, but does NOT add it to the system `PATH`. So when child processes (like Prisma's schema engine) try to call `node` via `/usr/bin/env node`, they fail with:
```
/usr/bin/env: 'node': No such file or directory
```

**Workaround**: Use `process.execPath` to find the running Node.js binary and inject its directory into PATH:
```javascript
const path = require('path');
const { execSync } = require('child_process');

const nodeDir = path.dirname(process.execPath);
const env = { ...process.env, PATH: `${nodeDir}:${process.env.PATH || ''}` };
execSync('./node_modules/.bin/prisma db push', { env });
```

### 3. Node.js binaries available via SSH (but NOT in PATH)
**Discovery**: Multiple Node.js versions are installed on the server but not in the default PATH:
```
/opt/alt/alt-nodejs18/root/usr/bin/node
/opt/alt/alt-nodejs20/root/usr/bin/node
/opt/alt/alt-nodejs22/root/usr/bin/node
/opt/alt/alt-nodejs24/root/usr/bin/node
```

**Usage from SSH**:
```bash
/opt/alt/alt-nodejs22/root/usr/bin/node ./node_modules/.bin/prisma db push
```

### 4. Execute permissions are stripped from binaries
**Problem**: After deployment, Prisma engine binaries in `node_modules/@prisma/engines/` lose their execute permissions, causing `EACCES` errors.

**Workaround**: Always `chmod +x` before using them:
```javascript
execSync('chmod +x ./node_modules/.bin/prisma ./node_modules/@prisma/engines/* 2>/dev/null || true');
```

### 5. Build environment CAN read environment variables
**Discovery**: Unlike some platforms, Hostinger's build environment DOES have access to the environment variables set in the deployment settings panel. We confirmed this because the build logs showed the correct database name and username from `DATABASE_URL`.

The initial auth failures during build were due to incorrect/cached passwords — NOT missing env vars.

### 6. Build environment CANNOT connect to `localhost` MySQL
**Problem**: The build process runs on a different network context and CANNOT connect to `localhost:3306` MySQL. This means any database operations during `npm install` / `postinstall` **will fail**.

**Error**: `P1001: Can't reach database server at localhost:3306`

**Solution**: Only run `prisma generate` during build (generates the client code, no DB needed). Run `prisma db push` at **server startup** in `server.js` where the runtime has network access.

### 7. SSH environment uses `mysql` client via Unix socket
**Discovery**: The `mysql` command works from SSH to `localhost` because it connects via **Unix socket** (not TCP). This is why `mysql -u user -p password db_name` works but Prisma (TCP-based) does not from SSH.

```bash
# This works from SSH (uses Unix socket):
mysql -u u398189227_nounx_chat_usr -pPASSWORD u398189227_nounx_chat -e 'SHOW TABLES;'

# This does NOT work from SSH (Prisma uses TCP):
./node_modules/.bin/prisma db push  # P1001: Can't reach database server
```

### 8. Entry file path has double slash
**Observation**: In stderr logs, the entry file path shows a double slash:
```
/home/u398189227/domains/.../public_html//src/server.js
```
This doesn't cause issues (Linux normalizes paths) but is worth noting.

### 9. Deployment does NOT auto-restart the running process
**Observation**: After a deployment completes, the old Node.js process may continue running with old code. A new request triggers LiteSpeed to spawn a new process, but during the transition you may see 503 errors briefly.

---

## ✅ Working Deployment Strategy

### `package.json` scripts:
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "postinstall": "prisma generate"
  }
}
```
> ⚠️ ONLY `prisma generate` in postinstall. No DB operations.

### `server.js` startup sync:
```javascript
const { execSync } = require('child_process');
const path = require('path');

try {
    const nodeDir = path.dirname(process.execPath);
    const env = { ...process.env, PATH: `${nodeDir}:${process.env.PATH || ''}` };
    execSync('chmod +x ./node_modules/.bin/prisma ./node_modules/@prisma/engines/* 2>/dev/null || true');
    const output = execSync('./node_modules/.bin/prisma db push --accept-data-loss 2>&1', { env }).toString();
    console.log('Database schema synced:', output);
} catch (err) {
    console.error('Schema sync failed:', err.stdout ? err.stdout.toString() : err.message);
}
```

### Environment Variables (set in Hostinger Deployment Settings):
```env
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DB_NAME
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
ERP_MIRROR_DB_URL=mysql://USER:PASSWORD@HOST:PORT/noun_erp_mirror
NODE_ENV=production
```
> ⚠️ If password contains special characters (`!`, `&`, `@`, `#`), URL-encode them.
> Example: `I!_pass&word` → `I%21_pass%26word`

---

## 📁 File Locations on Hostinger

| Item | Path |
|------|------|
| App root | `~/domains/lightpink-lark-246190.hostingersite.com/public_html/` |
| Node.js (v22) | `/opt/alt/alt-nodejs22/root/usr/bin/node` |
| Entry point | `public_html/src/server.js` |
| Prisma binary | `public_html/node_modules/.bin/prisma` |
| Prisma engines | `public_html/node_modules/@prisma/engines/` |
| Error log | `public_html/stderr.log` (ephemeral, cleared on restart) |
| Build logs | Visible in Hostinger hPanel → Deployments |

---

## 🔑 Environment Variables Solution

Hostinger's "Deployment Settings" panel for environment variables **Does NOT inject variables at runtime**. It only works during build.

**The ONLY working solution:**
1. Create a `.env` file manually in `public_html/`.
2. Secure it via `.htaccess`.
3. Restart the app using `tmp/restart.txt`.

### .htaccess Configuration (Crucial)
You must include the Passenger configuration block or the app won't start:
```apache
PassengerAppRoot /home/u398189227/domains/lightpink-lark-246190.hostingersite.com/public_html
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs22/root/bin/node
PassengerStartupFile src/server.js
PassengerBaseURI /

<Files .env>
Order allow,deny
Deny from all
</Files>
```

### Database Connection Issues (P1000/P1001)
If you get `P1001: Can't reach database server` or `P1000: Authentication failed` despite correct credentials:
1. **Use `127.0.0.1` instead of `localhost`** in your `DATABASE_URL`. Prisma uses TCP, and `localhost` might resolve to IPv6 or a socket.
   ```
   DATABASE_URL="mysql://user:pass@127.0.0.1:3306/db_name"
   ```
2. **Verify Credentials**: Run `mysql -u user -p -e 'SELECT 1'` to test access via shell.
3. **Manual Sync**: Run migration manually on the server:
   ```bash
   cd ~/domains/domain.com/public_html
   ./node_modules/.bin/prisma db push
   ```

### Persistence Warning
Manually created `.env` files in `public_html` **WILL be deleted** by Hostinger's Git deployment.
You MUST either:
- Commit `.env` to your private repo (easiest).
- Create `.env` outside `public_html` (e.g. `~/domains/domain.com/.env`) and symlink it (script needed).
- Use `ssh` to recreate it after every deploy.

### Restarting the App
After editing `.env` or deploying code, force a restart:
```bash
mkdir -p tmp
touch tmp/restart.txt
```

# Navigate to app
cd ~/domains/lightpink-lark-246190.hostingersite.com/public_html/

# Check MySQL tables
mysql -u u398189227_nounx_chat_usr -pPASSWORD u398189227_nounx_chat -e 'SHOW TABLES;'

# Run node command manually
/opt/alt/alt-nodejs22/root/usr/bin/node -e "console.log('works')"

# Run prisma via node (with chmod first)
chmod +x ./node_modules/.bin/prisma ./node_modules/@prisma/engines/*
DATABASE_URL='mysql://...' /opt/alt/alt-nodejs22/root/usr/bin/node ./node_modules/.bin/prisma db push

# Check error logs
cat stderr.log
```

---

## 🚨 Gotchas Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `npx: command not found` | Not in PATH | Use `./node_modules/.bin/` |
| `node: No such file or directory` | LiteSpeed doesn't set PATH | Inject `process.execPath` dir into PATH |
| `EACCES` on Prisma engines | Permissions stripped during deploy | `chmod +x` before use |
| `P1000: Auth failed` | Password special chars not encoded | URL-encode `!&@#` |
| `P1001: Can't reach DB` | Build env on different network | Only sync DB at runtime, not build |
| 503 after deploy | Old process still running | Wait for LiteSpeed auto-restart on next request |
