echo "Creating database at `date`...";
psql -f /sql/create-schema.sql sslmode=require -v userId="${PGUSER}";
echo "Installing database data...";
psql -f /sql/install-data.sql sslmode=require;
echo "Done";