# IIS Production Deployment Guide

This guide documents the production deployment of JubileeVerse on Windows Server with IIS and IISNode.

## Overview

JubileeVerse is deployed on Windows Server using:
- **IIS 10.0** (Windows Server 2019)
- **IISNode v0.2.26** for Node.js integration
- **URL Rewrite Module 2.0** for request routing
- **PostgreSQL 16** database
- **Node.js** via Windows named pipes

## Server Information

- **Hostname**: solarwinding
- **IP Address**: 10.0.0.4
- **OS**: Windows Server 2019 (Build 17763)
- **IIS Version**: 10.0
- **Node.js**: C:\Program Files\nodejs\node.exe
- **Website Domain**: www.jubileeverse.com

## Architecture

### Request Flow

```
Internet → IIS (Port 80/443)
         → URL Rewrite Module
         → IISNode (Named Pipe)
         → Node.js Process (server.js)
         → Express Application
         → Static Files or API Routes
```

### Key Components

1. **IIS** - Receives HTTP requests on port 80/443
2. **URL Rewrite** - Routes all requests to server.js
3. **IISNode** - Manages Node.js process lifecycle and communication via named pipes
4. **Express** - Handles routing, static files, and API endpoints
5. **PostgreSQL** - Database server (localhost:5432)

## Installation Steps

### Prerequisites

1. **Windows Server 2019** or later
2. **IIS 10.0** or later installed with:
   - Static Content
   - Default Document
   - HTTP Errors
   - HTTP Redirection
   - Request Filtering
3. **Node.js** installed at C:\Program Files\nodejs\node.exe
4. **PostgreSQL** installed and running

### Step 1: Install IIS Components

Open PowerShell as Administrator:

```powershell
# Install IIS if not already installed
Install-WindowsFeature -name Web-Server -IncludeManagementTools

# Install required IIS features
Install-WindowsFeature Web-Static-Content
Install-WindowsFeature Web-Default-Doc
Install-WindowsFeature Web-Http-Errors
Install-WindowsFeature Web-Http-Redirect
Install-WindowsFeature Web-Filtering
```

### Step 2: Install IISNode

1. Download IISNode from: https://github.com/Azure/iisnode/releases
2. Install the x64 version: `iisnode-v0.2.26-x64.msi`
3. Verify installation in IIS Manager → Handler Mappings

### Step 3: Install URL Rewrite Module

1. Download from: https://www.iis.net/downloads/microsoft/url-rewrite
2. Install: `rewrite_amd64_en-US.msi`
3. Verify installation in IIS Manager → URL Rewrite

### Step 4: Configure Application Directory

```powershell
# Navigate to application directory
cd C:\Data\JubileeVerse.com

# Install Node.js dependencies
npm install

# Run database migrations
npm run db:setup
```

### Step 5: Create IIS Site

Run PowerShell as Administrator:

```powershell
# Import IIS module
Import-Module WebAdministration

# Create new site
New-WebSite -Name "JubileeVerse" `
    -PhysicalPath "C:\Data\JubileeVerse.com" `
    -Port 80 `
    -HostHeader "www.jubileeverse.com"

# Set application pool to use No Managed Code
Set-ItemProperty IIS:\AppPools\JubileeVerse managedRuntimeVersion ""

# Grant IIS_IUSRS permissions
$acl = Get-Acl "C:\Data\JubileeVerse.com"
$permission = "IIS_IUSRS","FullControl","ContainerInherit,ObjectInherit","None","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl "C:\Data\JubileeVerse.com" $acl
```

### Step 6: Configure Hosts File (for local testing)

If testing locally, add to `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 www.jubileeverse.com
```

## Configuration Files

### web.config

The `web.config` file in the application root configures IISNode and URL rewriting:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- IISNode configuration -->
    <iisnode
      nodeProcessCommandLine="C:\Program Files\nodejs\node.exe"
      debuggingEnabled="false"
      devErrorsEnabled="false"
      loggingEnabled="true"
      logDirectory="iisnode"
      maxConcurrentRequestsPerProcess="1024"
      maxNamedPipeConnectionRetry="100"
      namedPipeConnectionRetryDelay="250"
      maxNamedPipeConnectionPoolSize="512"
      maxNamedPipePooledConnectionAge="30000"
      asyncCompletionThreadCount="0"
      initialRequestBufferSize="4096"
      maxRequestBufferSize="65536"
      watchedFiles="*.js;iisnode.yml"
      uncFileChangesPollingInterval="5000"
      gracefulShutdownTimeout="60000"
      enableXFF="false"
      promoteServerVars=""
      configOverrides="iisnode.yml"
      recycleSignalEnabled="false"
      idlePageOutTimePeriod="0"
      />

    <!-- URL Rewrite rules -->
    <rewrite>
      <rules>
        <!-- Don't interfere with iisnode debugging -->
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server.js\/debug[\/]?" />
        </rule>

        <!-- Route all requests to Node.js (Express will handle static files) -->
        <rule name="NodeJS">
          <match url=".*" />
          <action type="Rewrite" url="server.js"/>
        </rule>
      </rules>
    </rewrite>

    <!-- Make sure error responses are left untouched -->
    <httpErrors existingResponse="PassThrough" />

    <!-- Security headers -->
    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
      </customHeaders>
    </httpProtocol>

    <!-- Handlers -->
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode"/>
    </handlers>

    <!-- Static content caching -->
    <staticContent>
      <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" />
    </staticContent>
  </system.webServer>
</configuration>
```

### server.js - IISNode Integration

The server.js file detects IISNode and configures accordingly:

```javascript
// Check if running under IISNode
if (process.env.IISNODE_VERSION) {
  // Running under IISNode - need to start listening on the named pipe
  logger.info('Starting JubileeVerse under IISNode');

  // Initialize and start listening asynchronously
  (async () => {
    try {
      // Initialize services first
      await RedisClient.initialize();
      await database.initialize();

      const pgPool = database.getPostgres();
      if (pgPool && !pgPool.mock) {
        setPgPool(pgPool);
        logger.info('Session store configured with PostgreSQL');
      }

      // Create and start the app
      const app = createApp();

      // IISNode provides the port via process.env.PORT (named pipe)
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        logger.info('JubileeVerse listening for IISNode', { port: PORT });
      });

      // Initialize background workers
      AIResponseProcessor.initializeWorker({
        concurrency: config.queue?.concurrency || 10,
        rateLimit: config.queue?.rateLimit || 50
      });

      AttachmentCleanupJob.start();
      MonthlyAnalyticsAggregationJob.start();

      logger.info('JubileeVerse fully initialized for IISNode');
    } catch (error) {
      logger.error('IISNode initialization error', { error: error.message, stack: error.stack });
      process.exit(1);
    }
  })();
} else {
  // Running standalone - start the server normally
  start();
  module.exports = { start };
}
```

**Critical Points:**
- IISNode sets `process.env.IISNODE_VERSION` when running
- Node.js MUST call `app.listen(process.env.PORT)` to connect to the named pipe
- All initialization must complete before listening

## Security Configuration

### Rate Limiting

Custom rate limiter configuration for IIS environment ([src/middleware/security.js:39-42](src/middleware/security.js#L39-L42)):

```javascript
keyGenerator: (req) => {
  return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
}
```

**Why this is needed:** IIS/IISNode doesn't always properly set `req.ip`, causing rate limiter validation errors.

### Error Handling

Modified error handler to show operational errors in production ([src/middleware/errorHandler.js](src/middleware/errorHandler.js)):

```javascript
// Determine if we should show the error message
// Show message for operational errors (4xx) or in development
const showMessage = config.server.isDev || err.isOperational || statusCode < 500;
const errorMessage = showMessage ? err.message : 'Internal server error';
```

**Why this is needed:** Users need to see authentication errors (401) and validation errors (400) even in production.

### AppError Usage

All application errors use AppError class with proper status codes ([src/services/AuthService.js](src/services/AuthService.js)):

```javascript
const { AppError } = require('../middleware/errorHandler');

// Invalid credentials
throw new AppError('Invalid email or password', 401);

// Account deactivated
throw new AppError('Account is deactivated', 403);
```

## Database Configuration

### Connection Settings (.env)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jubileeverse
DB_USER=postgres
DB_PASSWORD=askShaddai4e!
```

### Test User Creation

Script: [scripts/create-test-user.js](scripts/create-test-user.js)

```powershell
node scripts/create-test-user.js
```

Creates/updates test user:
- Email: gabe.ungureanu@outlook.com
- Password: askShaddai4e!
- Display Name: Gabe Ungureanu

## Troubleshooting

### Issue 1: IISNode HRESULT 0x2 Error

**Symptoms:**
- Website returns 500 error
- IISNode logs show "HRESULT: 0x2" timeout error

**Cause:**
- Node.js application not calling `app.listen(process.env.PORT)`

**Solution:**
- Ensure server.js detects IISNode and calls `.listen()` on the named pipe port
- See server.js configuration above

### Issue 2: Static Files Return 404

**Symptoms:**
- CSS, JavaScript, and images not loading
- Browser shows 404 errors for static assets

**Cause:**
- URL Rewrite rules blocking static files from reaching Node.js

**Solution:**
- Remove separate static file rules
- Route ALL requests to Node.js (see web.config above)
- Let Express static middleware handle file serving

### Issue 3: Rate Limiter ValidationError

**Symptoms:**
- Crashes with "ValidationError: An undefined 'request.ip' was detected"
- Application logs show rate limiter errors

**Cause:**
- IIS/IISNode doesn't properly forward client IP address

**Solution:**
- Add custom keyGenerator to rate limiter (see Security Configuration above)

### Issue 4: Login Returns 500 Error

**Symptoms:**
- Login form shows "Internal server error"
- No specific error message displayed

**Cause:**
- AuthService throwing plain Error instead of AppError
- Error handler hiding all messages in production

**Solution:**
1. Use AppError with proper status codes in AuthService
2. Update error handler to show operational errors (see Error Handling above)

### Issue 5: Invalid Email or Password

**Symptoms:**
- Login shows "Invalid email or password" even with correct credentials

**Cause:**
- No user exists in database
- Password hash doesn't match

**Solution:**
- Run create-test-user.js script
- Verify password is hashed correctly (pbkdf2, 100000 iterations)

### Issue 6: Session Store Column Error (500 Error)

**Symptoms:**
- All requests return 500 Internal Server Error
- Logs show: `column "sess" of relation "user_sessions" does not exist`

**Cause:**
- The `connect-pg-simple` session store expects a table with columns: `sid`, `sess`, `expire`
- The existing `user_sessions` table has different columns (used for session metadata)

**Solution:**
1. Create the proper session store table:
```sql
CREATE TABLE IF NOT EXISTS session_store (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    CONSTRAINT session_store_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS session_store_expire_idx ON session_store (expire);
```

2. Update [src/middleware/session.js](src/middleware/session.js) to use `tableName: 'session_store'`

3. Restart IIS: `iisreset`

### Issue 7: Session Cookies Not Persisting (Logged Out After Refresh)

**Symptoms:**
- Login appears successful but user is logged out on page refresh
- Session cookie not being saved by browser

**Cause:**
- Session cookies set with `secure: true` require HTTPS
- IISNode serves HTTP, with IIS potentially handling HTTPS termination

**Solution:**
The session middleware automatically detects IISNode and disables secure cookies. If needed, override with:
```env
SESSION_SECURE=false  # Allow HTTP cookies (for development)
SESSION_SECURE=true   # Require HTTPS (for production with SSL)
```

## Monitoring and Logs

### IISNode Logs

Location: `C:\Data\JubileeVerse.com\iisnode\`

View recent logs:
```powershell
Get-ChildItem C:\Data\JubileeVerse.com\iisnode\ | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

### Application Logs

Location: `C:\Data\JubileeVerse.com\logs\`

View errors:
```powershell
Get-Content C:\Data\JubileeVerse.com\logs\error.log -Tail 50
```

### IIS Logs

Location: `C:\inetpub\logs\LogFiles\W3SVC*\`

View recent logs:
```powershell
Get-ChildItem C:\inetpub\logs\LogFiles\W3SVC* |
  Get-ChildItem |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 |
  Get-Content -Tail 50
```

## Performance Tuning

### IISNode Settings

Key performance settings in web.config:

```xml
maxConcurrentRequestsPerProcess="1024"
maxNamedPipeConnectionPoolSize="512"
maxNamedPipePooledConnectionAge="30000"
gracefulShutdownTimeout="60000"
```

### Static Content Caching

Set cache headers for 7 days:
```xml
<clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" />
```

### Application Pool Settings

```powershell
# Set recycling schedule
Set-ItemProperty IIS:\AppPools\JubileeVerse -Name Recycling.periodicRestart.time -Value "00:00:00"

# Disable idle timeout
Set-ItemProperty IIS:\AppPools\JubileeVerse -Name processModel.idleTimeout -Value "00:00:00"

# Set to AlwaysRunning
Set-ItemProperty IIS:\AppPools\JubileeVerse -Name startMode -Value "AlwaysRunning"
```

## Deployment Checklist

- [ ] IIS installed with required features
- [ ] IISNode v0.2.26 installed
- [ ] URL Rewrite Module 2.0 installed
- [ ] Node.js installed at C:\Program Files\nodejs\
- [ ] PostgreSQL running on localhost:5432
- [ ] Application code in C:\Data\JubileeVerse.com
- [ ] Dependencies installed (`npm install`)
- [ ] Database migrated (`npm run db:setup`)
- [ ] .env configured with NODE_ENV=production
- [ ] web.config configured
- [ ] server.js has IISNode detection
- [ ] IIS site created and running
- [ ] Permissions granted to IIS_IUSRS
- [ ] DNS or hosts file configured for www.jubileeverse.com
- [ ] Test user created
- [ ] Website accessible at http://www.jubileeverse.com
- [ ] Static files loading correctly
- [ ] Login functionality working
- [ ] Error handling working correctly

## Production Environment Variables

Required settings in .env:

```env
# Environment
NODE_ENV=production

# Server
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jubileeverse
DB_USER=postgres
DB_PASSWORD=askShaddai4e!

# Session
SESSION_SECRET=jubileeverse-production-secret-change-this-in-production-2024
SESSION_MAX_AGE=86400000

# GitHub
GITHUB_REPOSITORY=gabeungureanu/JubileeVerse.com
GITHUB_EMAIL=gabe.ungureanu@outlook.com

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=inspire_knowledge

# API Keys (from .env file)
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY_PRIMARY=your-key-here
GROK_API_KEY=your-key-here
```

## Quick Reference Commands

```powershell
# Check IIS sites
Get-Website

# Restart IIS site
Restart-WebAppPool -Name "JubileeVerse"

# Check IIS bindings
Get-WebBinding -Name "JubileeVerse"

# Test website
curl http://www.jubileeverse.com

# View IISNode logs
Get-ChildItem C:\Data\JubileeVerse.com\iisnode\ | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content

# Create test user
node scripts/create-test-user.js

# Run database migrations
npm run db:setup
```

## Support and Maintenance

### Regular Maintenance

1. **Check logs weekly** for errors and warnings
2. **Monitor disk space** in C:\Data\JubileeVerse\.datastore\
3. **Backup database** regularly
4. **Update dependencies** monthly
5. **Review security logs** for suspicious activity

### Health Checks

```powershell
# Check if site is responding
curl http://www.jubileeverse.com/api/admin/health

# Check database connection
node -e "require('./src/database').getPostgres().query('SELECT 1')"

# Check Redis connection
docker exec JubileeVerse-redis redis-cli PING
```

### Backup Procedures

```powershell
# Backup database
docker exec JubileeVerse-postgres pg_dump -U postgres jubileeverse > backup-$(Get-Date -Format 'yyyy-MM-dd').sql

# Backup entire application
Copy-Item -Path "C:\Data\JubileeVerse.com" -Destination "C:\Backups\JubileeVerse-$(Get-Date -Format 'yyyy-MM-dd')" -Recurse
```

## Additional Resources

- IISNode Documentation: https://github.com/Azure/iisnode
- URL Rewrite Documentation: https://www.iis.net/learn/extensions/url-rewrite-module
- Express Documentation: https://expressjs.com/
- PostgreSQL Documentation: https://www.postgresql.org/docs/

---

**Last Updated**: 2026-01-01
**Server**: solarwinding (10.0.0.4)
**Environment**: Production
**IIS Version**: 10.0
**IISNode Version**: 0.2.26
