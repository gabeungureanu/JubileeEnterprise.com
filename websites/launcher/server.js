/**
 * Jubilee Solutions - Development Launcher
 *
 * This is a simple development-only server that provides a landing page
 * with navigation links to all Jubilee projects. It is NOT intended for
 * production use and should not be deployed.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Service definitions with their ports and status
const services = [
  {
    name: 'JubileeBrowser.com',
    port: 3002,
    description: 'Marketing website for Jubilee Browser',
    category: 'Static Sites',
    status: 'active'
  },
  {
    name: 'JubileeInspire.com',
    port: 3003,
    description: 'Jubilee Inspire - Coming Soon',
    category: 'Coming Soon',
    status: 'planned'
  },
  {
    name: 'JubileeIntelligence.com',
    port: 3004,
    description: 'AI Content Generation with Vector Database',
    category: 'AI Services',
    status: 'active'
  },
  {
    name: 'JubileeInternet.com',
    port: 3005,
    description: 'SSO & Identity Services',
    category: 'Core Infrastructure',
    status: 'active'
  },
  {
    name: 'JubileePersonas.com',
    port: 3006,
    description: 'AI Persona Management System',
    category: 'AI Services',
    status: 'active'
  },
  {
    name: 'JubileeVerse.com',
    port: 3007,
    description: 'Faith-based AI Chat Platform',
    category: 'Core Applications',
    status: 'active'
  },
  {
    name: 'JubileeWebsites.com',
    port: 3008,
    description: 'AI-powered Website Generation',
    category: 'AI Services',
    status: 'active'
  }
];

// Infrastructure services
const infrastructure = [
  { name: 'PostgreSQL', port: 5432, description: 'Primary Database' },
  { name: 'Redis', port: 6379, description: 'Cache & Sessions' },
  { name: 'Qdrant', port: 6333, description: 'Vector Database' },
  { name: 'Mailhog', port: 8025, description: 'Email Testing UI' },
  { name: 'Redis Commander', port: 8081, description: 'Redis Management UI' },
  { name: 'pgAdmin', port: 8082, description: 'PostgreSQL Management UI' }
];

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoint for services list
app.get('/api/services', (req, res) => {
  res.json({ services, infrastructure });
});

// Main page
app.get('/', (req, res) => {
  const html = generateLandingPage();
  res.send(html);
});

function generateLandingPage() {
  const categories = [...new Set(services.map(s => s.category))];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jubilee Solutions - Development Launcher</title>
  <style>
    :root {
      --primary: #4F46E5;
      --primary-dark: #4338CA;
      --success: #10B981;
      --warning: #F59E0B;
      --gray-50: #F9FAFB;
      --gray-100: #F3F4F6;
      --gray-200: #E5E7EB;
      --gray-600: #4B5563;
      --gray-800: #1F2937;
      --gray-900: #111827;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      color: white;
      margin-bottom: 3rem;
    }

    header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .category-section {
      margin-bottom: 2rem;
    }

    .category-title {
      color: white;
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-left: 0.5rem;
      border-left: 4px solid rgba(255,255,255,0.5);
    }

    .card {
      background: white;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .card h3 {
      color: var(--gray-900);
      font-size: 1.125rem;
    }

    .port {
      background: var(--gray-100);
      color: var(--gray-600);
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-family: monospace;
    }

    .card p {
      color: var(--gray-600);
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-active .status-dot { background: var(--success); }
    .status-planned .status-dot { background: var(--warning); }

    .card-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
    }

    .btn-secondary {
      background: var(--gray-100);
      color: var(--gray-800);
    }

    .btn-secondary:hover {
      background: var(--gray-200);
    }

    .infrastructure-section {
      background: rgba(255,255,255,0.1);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-top: 2rem;
    }

    .infrastructure-section h2 {
      color: white;
      margin-bottom: 1rem;
    }

    .infra-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .infra-item {
      background: rgba(255,255,255,0.9);
      padding: 1rem;
      border-radius: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .infra-item span {
      font-weight: 500;
      color: var(--gray-800);
    }

    .infra-item .port {
      background: var(--gray-200);
    }

    footer {
      text-align: center;
      color: rgba(255,255,255,0.7);
      margin-top: 3rem;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Jubilee Solutions</h1>
      <p>Development Launcher - Local Navigation Hub</p>
      <span class="badge">Development Mode Only</span>
    </header>

    ${categories.map(category => `
      <section class="category-section">
        <h2 class="category-title">${category}</h2>
        <div class="grid">
          ${services.filter(s => s.category === category).map(service => `
            <div class="card">
              <div class="card-header">
                <h3>${service.name}</h3>
                <span class="port">:${service.port}</span>
              </div>
              <p>${service.description}</p>
              <div class="status status-${service.status}">
                <span class="status-dot"></span>
                ${service.status}
              </div>
              <div class="card-actions">
                <a href="http://localhost:${service.port}" target="_blank" class="btn btn-primary">
                  Open
                </a>
                <a href="http://localhost:${service.port}/api" target="_blank" class="btn btn-secondary">
                  API
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('')}

    <section class="infrastructure-section">
      <h2>Infrastructure Services</h2>
      <div class="infra-grid">
        ${infrastructure.map(infra => `
          <div class="infra-item">
            <div>
              <span>${infra.name}</span>
              <p style="font-size: 0.75rem; color: var(--gray-600); margin: 0;">${infra.description}</p>
            </div>
            <span class="port">:${infra.port}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <footer>
      <p>This launcher is for development purposes only.</p>
      <p>Run <code>npm run docker:infra</code> from the solution root to start infrastructure services.</p>
    </footer>
  </div>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   JUBILEE SOLUTIONS LAUNCHER                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(\`║  Launcher running at: http://localhost:\${PORT}                    ║\`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Available Services:                                          ║');
  services.forEach(s => {
    const status = s.status === 'active' ? '✓' : '○';
    console.log(\`║  \${status} \${s.name.padEnd(25)} http://localhost:\${s.port}    ║\`);
  });
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
});
