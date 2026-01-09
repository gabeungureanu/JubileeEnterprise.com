# Quick Database Setup Guide - pgAdmin Approach

Uncle, since we're encountering authentication issues with the command line, here's the quickest way to set up the databases using **pgAdmin 4**:

---

## Step 1: Open pgAdmin 4

Launch pgAdmin 4 from your Windows Start Menu or desktop.

---

## Step 2: Create the 'guardian' User (if not exists)

1. In pgAdmin, expand your PostgreSQL server
2. Right-click **Login/Group Roles** → **Create** → **Login/Group Role**
3. **General Tab:**
   - Name: `guardian`
4. **Definition Tab:**
   - Password: `askShaddai4e!`
   - Confirm: `askShaddai4e!`
5. **Privileges Tab:**
   - ✓ Can login?
   - ✓ Create databases?
6. Click **Save**

---

## Step 3: Create the Databases

### Create CODEX Database
1. Right-click **Databases** → **Create** → **Database**
2. **General Tab:**
   - Database: `codex`
   - Owner: `guardian`
3. Click **Save**

### Create INSPIRE Database
1. Right-click **Databases** → **Create** → **Database**
2. **General Tab:**
   - Database: `inspire`
   - Owner: `guardian`
3. Click **Save**

### Create CONTINUUM Database
1. Right-click **Databases** → **Create** → **Database**
2. **General Tab:**
   - Database: `continuum`
   - Owner: `guardian`
3. Click **Save**

---

## Step 4: Initialize CODEX Database

1. In pgAdmin, expand **Databases** → **codex**
2. Click **Tools** → **Query Tool**
3. Click **Open File** icon
4. Navigate to: `d:\data\JubileeEnterprise.com\scripts\setup_codex_db.sql`
5. Click **Execute** (▶ button or F5)
6. Verify you see: "Query returned successfully"

---

## Step 5: Verify Setup

Run this in the Query Tool (on codex database):

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check admin user exists
SELECT email, display_name, role FROM users;
```

You should see:
- Tables: `users`, `session`
- Admin user: `admin@jubileeenterprise.com`

---

## ✅ Setup Complete!

Your databases are now ready:

| Database | Purpose | Owner |
|----------|---------|-------|
| **codex** | JubileeBrowser, JubileeVerse, all Jubilee products | guardian |
| **inspire** | 12 Inspire Family personas data | guardian |
| **continuum** | All Jubilee ecosystem users | guardian |

### Connection Details (from your env file):
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=guardian
DB_PASSWORD=askShaddai4e!
DB_NAME=codex (or inspire, or continuum per application)
```

---

## Alternative: Use SQL Scripts Directly in pgAdmin

If you prefer to use the automated scripts:

1. Open **Query Tool** (Tools → Query Tool)
2. Click **Open File**
3. Select: `scripts/create_databases.sql`
4. Click **Execute** (F5)
5. Then run `scripts/setup_codex_db.sql` against the codex database

---

## Next Steps:

- ✅ Databases created
- ✅ Codex initialized with users and session tables
- 🔄 Configure application environments
- 🔄 Run application-specific migrations
- 🔄 Test connections from applications

---

**Note:** The `flywheel` database is pending and will be created when needed for the Jubilee Algo application.
