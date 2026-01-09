# Database Setup Guide for Jubilee Enterprise

This guide will help you create the required PostgreSQL databases for Jubilee Enterprise.

## Databases to Create

1. **codex** - For JubileeVerse and Codex applications
2. **inspire** - For Inspire family applications
3. **continuum** - For Continuum applications

All databases will use the `guardian` user with password `askShaddai4e!` as configured in your [env](../env) file.

---

## Prerequisites

- PostgreSQL installed and running
- PostgreSQL client tools (psql) available in your PATH
- Admin access to PostgreSQL (postgres user credentials)

---

## Option 1: Automated Setup (Recommended)

### For Windows Users

1. **Double-click** the batch file:
   ```
   scripts\create-databases.bat
   ```

2. **Or run via PowerShell:**
   ```powershell
   cd d:\data\JubileeEnterprise.com
   .\scripts\create-databases.ps1
   ```

3. Enter the PostgreSQL `postgres` user password when prompted

4. The script will:
   - Create the `guardian` role if it doesn't exist
   - Create all three databases (codex, inspire, continuum)
   - Set proper ownership and permissions
   - Display success message with next steps

---

## Option 2: Manual Setup via pgAdmin

### Step 1: Create the guardian user

1. Open **pgAdmin 4**
2. Connect to your PostgreSQL server
3. Right-click on **Login/Group Roles** → **Create** → **Login/Group Role**
4. In the **General** tab:
   - Name: `guardian`
5. In the **Definition** tab:
   - Password: `askShaddai4e!`
6. In the **Privileges** tab:
   - Enable: `Can login?`
   - Enable: `Create databases?`
7. Click **Save**

### Step 2: Create the databases

For each database (codex, inspire, continuum):

1. Right-click on **Databases** → **Create** → **Database**
2. In the **General** tab:
   - Database: `codex` (or `inspire`, or `continuum`)
   - Owner: `guardian`
   - Comment: `JubileeVerse and Codex applications database` (adjust per database)
3. In the **Definition** tab:
   - Encoding: `UTF8`
   - Collation: `en_US.UTF-8`
   - Character type: `en_US.UTF-8`
4. Click **Save**

Repeat for `inspire` and `continuum` databases.

---

## Option 3: Manual Setup via psql Command Line

### Step 1: Connect as postgres user

```bash
psql -h localhost -U postgres
```

### Step 2: Run the SQL commands

```sql
-- Create the guardian role
CREATE ROLE guardian WITH LOGIN PASSWORD 'askShaddai4e!' CREATEDB;

-- Create codex database
CREATE DATABASE codex
    WITH OWNER = guardian
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8';

-- Create inspire database
CREATE DATABASE inspire
    WITH OWNER = guardian
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8';

-- Create continuum database
CREATE DATABASE continuum
    WITH OWNER = guardian
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE codex TO guardian;
GRANT ALL PRIVILEGES ON DATABASE inspire TO guardian;
GRANT ALL PRIVILEGES ON DATABASE continuum TO guardian;

-- Exit psql
\q
```

---

## Option 4: Use the SQL File Directly

If you have psql in your PATH:

```bash
cd d:\data\JubileeEnterprise.com
psql -h localhost -U postgres -f scripts\create_databases.sql
```

Or via pgAdmin:
1. Open pgAdmin 4
2. Connect to your PostgreSQL server
3. Click **Tools** → **Query Tool**
4. Click **Open File** and select `scripts/create_databases.sql`
5. Click **Execute** (F5)

---

## Post-Setup: Initialize Codex Database

After creating the databases, you need to initialize the codex database with tables:

1. **Connect to codex database:**
   ```bash
   psql -h localhost -U guardian -d codex
   ```

2. **Run the setup script:**
   ```sql
   \i scripts/setup_codex_db.sql
   ```

   Or via pgAdmin:
   - Right-click on the **codex** database
   - Select **Query Tool**
   - Open `scripts/setup_codex_db.sql`
   - Execute (F5)

This will create:
- `users` table for authentication
- `session` table for session management
- Indexes for performance
- Default admin user (admin@jubileeenterprise.com / askShaddai4e!)

---

## Verification

### Check databases exist:

```bash
psql -h localhost -U guardian -l
```

You should see `codex`, `inspire`, and `continuum` in the list.

### Check codex tables:

```bash
psql -h localhost -U guardian -d codex -c "\dt"
```

You should see `users` and `session` tables.

### Test connection:

```bash
psql -h localhost -U guardian -d codex -c "SELECT * FROM users;"
```

You should see the admin user.

---

## Troubleshooting

### psql not found
- Make sure PostgreSQL is installed
- Add PostgreSQL bin directory to PATH:
  - Common path: `C:\Program Files\PostgreSQL\16\bin`
  - Or: `C:\Program Files\PostgreSQL\15\bin`

### Connection refused
- Ensure PostgreSQL service is running
- Check if PostgreSQL is listening on localhost:5432
- Verify `pg_hba.conf` allows local connections

### Authentication failed
- Verify you're using the correct postgres password
- Check `pg_hba.conf` authentication method

### Permission denied
- Ensure you're running as postgres user for initial setup
- The postgres user has superuser privileges

---

## Environment Configuration

After creating the databases, verify your [env](../env) file has the correct configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=codex
DB_USER=guardian
DB_PASSWORD=askShaddai4e!
```

For inspire and continuum applications, update their respective configuration files to use:
- `DB_NAME=inspire` or `DB_NAME=continuum`
- Same `DB_USER=guardian` and `DB_PASSWORD=askShaddai4e!`

---

## Next Steps

1. ✅ Create databases (codex, inspire, continuum)
2. ✅ Initialize codex database with tables
3. 🔄 Configure application environment files
4. 🔄 Run database migrations for each application
5. 🔄 Start your applications

---

## Files Reference

- [create_databases.sql](./create_databases.sql) - SQL script to create all databases
- [create-databases.ps1](./create-databases.ps1) - PowerShell automation script
- [create-databases.bat](./create-databases.bat) - Batch file wrapper
- [setup_codex_db.sql](./setup_codex_db.sql) - Codex database table schema
- [../env](../env) - Environment configuration file

---

## Support

If you encounter issues:
1. Check PostgreSQL logs
2. Verify PostgreSQL service is running
3. Test connection with: `psql -h localhost -U postgres`
4. Review PostgreSQL documentation for your version
