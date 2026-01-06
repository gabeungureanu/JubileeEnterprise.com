#!/bin/bash
# JubileeVerse Production Startup Script for Git Bash
# Server: solarwinding (10.0.0.4)

echo ""
echo "======================================"
echo "  JubileeVerse Production Startup"
echo "======================================"
echo ""
echo "Server: solarwinding (10.0.0.4)"
echo "Working Directory: $(pwd)"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Step 1: Check Node.js
echo -e "${CYAN}[1/5] Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo -e "${YELLOW}Please install Node.js 18+ from https://nodejs.org/${NC}"
    echo ""
    exit 1
fi
echo ""

# Step 2: Check Docker
echo -e "${CYAN}[2/5] Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker installed: $DOCKER_VERSION${NC}"

    # Check if Docker daemon is running
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓ Docker daemon is running${NC}"
    else
        echo -e "${RED}✗ Docker daemon is not running${NC}"
        echo -e "${YELLOW}Please start Docker Desktop and try again${NC}"
        echo ""
        exit 1
    fi
else
    echo -e "${RED}✗ Docker not found${NC}"
    echo -e "${YELLOW}Please install Docker Desktop or run:${NC}"
    echo -e "${YELLOW}  powershell.exe -File scripts/install-docker-windows.ps1${NC}"
    echo ""
    exit 1
fi
echo ""

# Step 3: Check/Start Containers
echo -e "${CYAN}[3/5] Checking containers...${NC}"
POSTGRES_RUNNING=$(docker ps --filter "name=JubileeVerse-postgres" --format "{{.Names}}")
QDRANT_RUNNING=$(docker ps --filter "name=JubileeVerse-qdrant" --format "{{.Names}}")
REDIS_RUNNING=$(docker ps --filter "name=JubileeVerse-redis" --format "{{.Names}}")

if [ ! -z "$POSTGRES_RUNNING" ] && [ ! -z "$QDRANT_RUNNING" ] && [ ! -z "$REDIS_RUNNING" ]; then
    echo -e "${GREEN}✓ All containers are running${NC}"
else
    echo -e "${YELLOW}Starting containers...${NC}"

    # Check if containers exist but are stopped
    POSTGRES_EXISTS=$(docker ps -a --filter "name=JubileeVerse-postgres" --format "{{.Names}}")

    if [ ! -z "$POSTGRES_EXISTS" ]; then
        # Containers exist, just start them
        echo "  Starting existing containers..."
        docker-compose -f docker-compose.production.yml start
    else
        # Create new containers
        echo "  Creating new containers..."
        docker-compose -f docker-compose.production.yml up -d
    fi

    # Wait for containers to be ready
    echo "  Waiting for containers to be ready..."
    sleep 10

    # Verify containers are running
    if docker ps --filter "name=JubileeVerse-postgres" --format "{{.Names}}" | grep -q "JubileeVerse-postgres"; then
        echo -e "${GREEN}✓ Containers started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start containers${NC}"
        echo -e "${YELLOW}Check logs: docker-compose -f docker-compose.production.yml logs${NC}"
        exit 1
    fi
fi
echo ""

# Step 4: Check Dependencies
echo -e "${CYAN}[4/5] Checking Node.js dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
fi
echo ""

# Step 5: Check Database
echo -e "${CYAN}[5/5] Checking database...${NC}"
DB_CHECK=$(docker exec JubileeVerse-postgres psql -U guardian -d JubileeVerse -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1)

if [ $? -eq 0 ]; then
    TABLE_COUNT=$(echo "$DB_CHECK" | tr -d ' \n')
    if [ "$TABLE_COUNT" -gt "50" ]; then
        echo -e "${GREEN}✓ Database initialized ($TABLE_COUNT tables)${NC}"
    else
        echo -e "${YELLOW}Running database migrations...${NC}"
        npm run db:setup
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database migrations completed${NC}"
        else
            echo -e "${RED}✗ Database migrations failed${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}Database not ready, running setup...${NC}"
    sleep 5
    npm run db:setup
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database initialized${NC}"
    else
        echo -e "${RED}✗ Database setup failed${NC}"
        echo -e "${YELLOW}Try manually: npm run db:setup${NC}"
        exit 1
    fi
fi
echo ""

# Display Status
echo "======================================"
echo -e "${GREEN}✓ All Systems Ready!${NC}"
echo "======================================"
echo ""
echo "Container Status:"
docker ps --filter "name=JubileeVerse" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -4
echo ""
echo -e "${CYAN}Services:${NC}"
echo "  PostgreSQL : localhost:5432 (Database: JubileeVerse)"
echo "  Qdrant     : http://localhost:6333/dashboard"
echo "  Redis      : localhost:6379"
echo ""
echo -e "${CYAN}Start the application:${NC}"
echo -e "  ${GREEN}npm start${NC}       - Production mode"
echo -e "  ${GREEN}npm run dev${NC}     - Development mode (auto-reload)"
echo ""
echo -e "${CYAN}After starting, visit:${NC}"
echo "  http://localhost:3000"
echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo "  docker-compose -f docker-compose.production.yml logs -f"
echo "  docker-compose -f docker-compose.production.yml restart"
echo "  docker exec -it JubileeVerse-postgres psql -U guardian -d JubileeVerse"
echo ""
