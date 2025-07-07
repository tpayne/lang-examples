#!/bin/bash

# MySQL Connection Details
# IMPORTANT: Replace with your actual MySQL username and password if set.
# For security, avoid hardcoding passwords in production scripts.
MYSQL_HOST="localhost"
MYSQL_USER="root"
MYSQL_PASSWORD="" # <--- LEAVE EMPTY IF NO PASSWORD, OTHERWISE SET IT HERE!
DATABASE_NAME="my_company_db"
SCHEMA_NAME="my_company_schema" # In MySQL, schema is synonymous with database

echo "--- MySQL Database Setup Script ---"

# Function to execute MySQL commands with optional password and database
execute_mysql_command() {
  local query="$1"
  local db_name="$2" # Optional: database to connect to

  local mysql_args=("-h" "$MYSQL_HOST" "-u" "$MYSQL_USER")

  # Add password flag only if password is not empty
  if [ -n "$MYSQL_PASSWORD" ]; then
    mysql_args+=("-p$MYSQL_PASSWORD") # No space between -p and password for security
  fi

  # Add database name if provided, before the -e flag
  if [ -n "$db_name" ]; then
    mysql_args+=("$db_name")
  fi

  echo "Executing: $query"
  # Execute mysql with arguments and the query using -e
  # Using an array for arguments is safer than eval for complex commands
  mysql "${mysql_args[@]}" -e "$query"
  if [ $? -ne 0 ]; then
    echo "Error executing MySQL command: $query"
    exit 1
  fi
}

echo "1. Creating MySQL database (schema): $DATABASE_NAME"
execute_mysql_command "CREATE DATABASE IF NOT EXISTS \`$DATABASE_NAME\`;"
echo "Database '$DATABASE_NAME' created or already exists."

echo "2. Creating 'customer_details' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`customer_details\` (
    customer_number INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_address TEXT,
    bank_sort_code VARCHAR(6) NOT NULL,
    bank_account_number VARCHAR(10) NOT NULL,
    bank_name VARCHAR(255)
);
" "$DATABASE_NAME"
echo "'customer_details' table created or already exists."

echo "3. Creating 'invoice' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`invoice\` (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_number INT NOT NULL,
    invoice_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50),
    FOREIGN KEY (customer_number) REFERENCES customer_details(customer_number)
);
" "$DATABASE_NAME"
# No need for if [ $? -ne 0 ] here, as execute_mysql_command already handles exit on error
echo "'invoice' table created or already exists."

echo "4. Inserting dummy data into 'customer_details'."
execute_mysql_command "
INSERT INTO \`customer_details\` (customer_name, customer_address, bank_sort_code, bank_account_number, bank_name) VALUES
('Alice Smith', '123 Main St, Anytown, USA', '112233', '1234567890', 'First National Bank'),
('Bob Johnson', '456 Oak Ave, Otherville, USA', '445566', '0987654321', 'Community Credit Union'),
('Charlie Brown', '789 Pine Ln, Somewhere, USA', '778899', '1122334455', 'Global Bank');
" "$DATABASE_NAME"
echo "Dummy data inserted into 'customer_details'."

echo "5. Inserting dummy data into 'invoice'."
# Get customer numbers for foreign key references using the new function
# -N: Don't write column names in results. -s: Silent mode, suppress extra output.
CUSTOMER_ALICE=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Alice Smith';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_BOB=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Bob Johnson';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_CHARLIE=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Charlie Brown';" "$DATABASE_NAME" | tail -n 1)

execute_mysql_command "
INSERT INTO \`invoice\` (customer_number, invoice_date, amount, status) VALUES
(${CUSTOMER_ALICE}, '2024-01-15', 150.75, 'Paid'),
(${CUSTOMER_BOB}, '2024-02-01', 200.00, 'Pending'),
(${CUSTOMER_ALICE}, '2024-03-10', 75.20, 'Paid'),
(${CUSTOMER_CHARLIE}, '2024-04-05', 300.50, 'Overdue');
" "$DATABASE_NAME"
echo "Dummy data inserted into 'invoice'."

echo "--- Database setup complete! ---"
echo "You can now connect to MySQL database '$DATABASE_NAME' and explore the tables."
