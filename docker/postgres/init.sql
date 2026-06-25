-- PostgreSQL initialization script
-- This runs only on first container startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The application will handle schema migration via Prisma
