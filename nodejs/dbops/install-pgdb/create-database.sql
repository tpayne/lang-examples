--
-- This is a sample script to create a demo database with simple defaults
--

-- Create the database
CREATE DATABASE demoapp
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;

COMMENT ON DATABASE demoapp
    IS 'This is a datasebase for a Demo App only';
