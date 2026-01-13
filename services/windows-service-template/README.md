# Windows Service Template for Node.js Applications

A production-ready Windows Service template with clustering and zero-downtime reload capabilities.

## Features

- **Multi-core clustering**: Automatically spawns workers across all CPU cores (this system: 16 cores / 32 threads)
- **Zero-downtime reload**: Restart workers one at a time with no service interruption
- **Auto-restart**: Workers automatically restart on crash
- **Windows boot auto-start**: Service starts automatically when Windows boots
- **Graceful shutdown**: Clean shutdown handling for all workers

## System Requirements

- Windows Server or Windows 10/11
- Node.js 18+ installed
- Administrator privileges (for service installation)
- `node-windows` npm package installed globally

## Installation

### 1. Install node-windows globally

```bash
npm install -g node-windows
```

### 2. Copy template files to your project

Copy these files to your Node.js application root:

- `server-cluster.js` - Cluster wrapper (modify NUM_WORKERS if needed)
- `install-service.js` - Service installer (modify service name and paths)
- `uninstall-service.js` - Service uninstaller
- `reload-service.js` - Zero-downtime reload trigger

### 3. Configure for your application

Edit `install-service.js`:

```javascript
const svc = new Service({
  name: 'YourServiceName',                    // Change this
  description: 'Your Service Description',    // Change this
  script: path.join(__dirname, 'server-cluster.js'),
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3000' }           // Change port if needed
  ]
});
```

Edit `server-cluster.js` if your main server file is not `server.js`:

```javascript
const WORKER_SCRIPT = path.join(__dirname, 'your-server.js');
```

### 4. Install the service (as Administrator)

```bash
node install-service.js
```

### 5. Verify installation

```bash
sc query "yourservicename.exe"
```

## Usage

### Start/Stop Service

```bash
# Using Windows Service Control
sc start "yourservicename.exe"
sc stop "yourservicename.exe"

# Or via Services GUI (services.msc)
```

### Zero-Downtime Reload

After deploying new code:

```bash
node reload-service.js
```

This restarts workers one at a time, ensuring at least one worker is always handling requests.

### Uninstall Service

```bash
node uninstall-service.js
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Windows Service                        │
│                   (jubileeverse.exe)                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│    ┌─────────────────────────────────────────────┐      │
│    │           Cluster Master Process            │      │
│    │           (server-cluster.js)               │      │
│    │                                             │      │
│    │  • Manages worker lifecycle                 │      │
│    │  • Handles reload signals                   │      │
│    │  • Auto-restarts crashed workers            │      │
│    └─────────────────────────────────────────────┘      │
│                          │                               │
│         ┌────────────────┼────────────────┐             │
│         ▼                ▼                ▼             │
│    ┌─────────┐     ┌─────────┐     ┌─────────┐         │
│    │ Worker  │     │ Worker  │     │ Worker  │  ...    │
│    │   #1    │     │   #2    │     │   #3    │         │
│    │ :3000   │     │ :3000   │     │ :3000   │         │
│    └─────────┘     └─────────┘     └─────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Performance

| Configuration | Requests/sec | Concurrent Users |
|--------------|--------------|------------------|
| Single process | ~5,000-10,000 | ~1,000-5,000 |
| Clustered (16 cores) | ~80,000-160,000 | ~16,000-80,000 |

## Monitoring

### View Service Status

```bash
sc query "yourservicename.exe"
```

### View Logs

Logs are stored in the `daemon/` folder within your application directory:

- `yourservicename.out.log` - Standard output
- `yourservicename.err.log` - Error output
- `yourservicename.wrapper.log` - Wrapper logs

### Check Worker Count

The cluster spawns one worker per CPU core by default. Override with:

```bash
set CLUSTER_WORKERS=8
node server-cluster.js
```

## Troubleshooting

### Service won't start

1. Check logs in `daemon/` folder
2. Ensure Node.js is in system PATH
3. Run `node server-cluster.js` manually to see errors

### Workers keep crashing

1. Check `daemon/*.err.log` for error messages
2. Ensure all dependencies are installed
3. Verify environment variables are set correctly

### Reload not working

1. Ensure `.reload-trigger` file is being created
2. Check that cluster master PID file exists (`.cluster-master.pid`)
3. Verify file watcher is active in cluster master

## Files

| File | Purpose |
|------|---------|
| `server-cluster.js` | Cluster master that spawns and manages workers |
| `install-service.js` | Installs the Windows Service |
| `uninstall-service.js` | Removes the Windows Service |
| `reload-service.js` | Triggers zero-downtime reload |
| `.cluster-master.pid` | Runtime file with master process PID |
| `.reload-trigger` | Touched to trigger reload |
| `daemon/` | Service logs and runtime files |

## Currently Installed Services

| Service | Application | Port | Status |
|---------|-------------|------|--------|
| jubileeverse.exe | JubileeVerse.com | 3000 | Active |

---

*Template created for JubileeEnterprise.com production deployments*
