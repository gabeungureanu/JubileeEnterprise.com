-- Create separate databases for each Jubilee service
-- This script runs automatically when the PostgreSQL container is first created

-- Create databases for each service
CREATE DATABASE jubilee_internet;
CREATE DATABASE jubilee_verse;
CREATE DATABASE jubilee_personas;
CREATE DATABASE jubilee_intelligence;
CREATE DATABASE jubilee_websites;
CREATE DATABASE jubilee_browser;
CREATE DATABASE jubilee_inspire;

-- Grant all privileges to the jubilee user
GRANT ALL PRIVILEGES ON DATABASE jubilee_internet TO jubilee;
GRANT ALL PRIVILEGES ON DATABASE jubilee_verse TO jubilee;
GRANT ALL PRIVILEGES ON DATABASE jubilee_personas TO jubilee;
GRANT ALL PRIVILEGES ON DATABASE jubilee_intelligence TO jubilee;
GRANT ALL PRIVILEGES ON DATABASE jubilee_websites TO jubilee;
GRANT ALL PRIVILEGES ON DATABASE jubilee_browser TO jubilee;
GRANT ALL PRIVILEGES ON DATABASE jubilee_inspire TO jubilee;

-- Enable required extensions in each database
\c jubilee_internet
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c jubilee_verse
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c jubilee_personas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c jubilee_intelligence
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c jubilee_websites
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c jubilee_browser
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c jubilee_inspire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
