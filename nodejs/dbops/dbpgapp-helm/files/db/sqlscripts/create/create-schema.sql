--
-- This is a sample script to create a demo database with simple defaults
--

--
-- The following will create a demo schema within this database
--

-- Create the schema
CREATE SCHEMA IF NOT EXISTS demoapp
    AUTHORIZATION :userId;

COMMENT ON SCHEMA demoapp
    IS 'This is a schema for the demo app';