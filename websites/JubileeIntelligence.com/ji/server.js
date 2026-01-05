import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Data directory
const DATA_DIR = path.resolve(__dirname, '../data');

app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper: Get file path for an entry
function getEntryPath(entry) {
  const domain = entry.domain || 'Uncategorized';
  const persona = entry.persona;

  let dir;
  if (persona) {
    dir = path.join(DATA_DIR, domain, persona);
  } else {
    dir = path.join(DATA_DIR, domain);
  }

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create safe filename from title
  const safeTitle = entry.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  return path.join(dir, `${entry.id}-${safeTitle}.yaml`);
}

// Helper: Find entry file by ID
function findEntryById(id) {
  function searchDir(dir) {
    if (!fs.existsSync(dir)) return null;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const result = searchDir(fullPath);
        if (result) return result;
      } else if (item.endsWith('.yaml') && item.startsWith(id + '-')) {
        return fullPath;
      }
    }
    return null;
  }

  return searchDir(DATA_DIR);
}

// Helper: Load all entries
function loadAllEntries() {
  const entries = [];

  function searchDir(dir) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (item.endsWith('.yaml')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const entry = yaml.load(content);
          if (entry && entry.id) {
            entries.push(entry);
          }
        } catch (err) {
          console.error(`Error reading ${fullPath}:`, err.message);
        }
      }
    }
  }

  searchDir(DATA_DIR);
  return entries;
}

// GET /api/entries - List all entries
app.get('/api/entries', (req, res) => {
  try {
    const entries = loadAllEntries();
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/entries/:id - Get single entry
app.get('/api/entries/:id', (req, res) => {
  try {
    const filePath = findEntryById(req.params.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const entry = yaml.load(content);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/entries - Create new entry
app.post('/api/entries', (req, res) => {
  try {
    const entry = req.body;
    if (!entry.id) {
      entry.id = Date.now().toString();
    }
    if (!entry.createdAt) {
      entry.createdAt = new Date().toISOString();
    }
    entry.updatedAt = new Date().toISOString();

    const filePath = getEntryPath(entry);
    const yamlContent = yaml.dump(entry, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    fs.writeFileSync(filePath, yamlContent, 'utf8');

    console.log(`Created: ${filePath}`);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/entries/:id - Update entry
app.put('/api/entries/:id', (req, res) => {
  try {
    const entry = req.body;
    entry.updatedAt = new Date().toISOString();

    // Find and delete old file if it exists
    const oldPath = findEntryById(req.params.id);
    if (oldPath) {
      fs.unlinkSync(oldPath);
    }

    // Write to new location (in case domain/persona changed)
    const newPath = getEntryPath(entry);
    const yamlContent = yaml.dump(entry, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    fs.writeFileSync(newPath, yamlContent, 'utf8');

    console.log(`Updated: ${newPath}`);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/entries/:id - Delete entry
app.delete('/api/entries/:id', (req, res) => {
  try {
    const filePath = findEntryById(req.params.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    fs.unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Jubilee Intelligence API Server`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Data directory: ${DATA_DIR}\n`);
});
