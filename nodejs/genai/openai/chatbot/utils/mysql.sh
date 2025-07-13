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
    customer_name VARCHAR(255) NOT NULL UNIQUE, -- Added UNIQUE constraint
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
echo "'invoice' table created or already exists."

echo "4. Creating 'suppliers' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`suppliers\` (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL UNIQUE,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE,
    address TEXT
);
" "$DATABASE_NAME"
echo "'suppliers' table created or already exists."

echo "5. Creating 'products' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`products\` (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    unit_price DECIMAL(10, 2) NOT NULL,
    supplier_id INT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);
" "$DATABASE_NAME"
echo "'products' table created or already exists."

echo "6. Creating 'stock' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`stock\` (
    stock_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL UNIQUE, -- Each product has one stock entry
    quantity_on_hand INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);
" "$DATABASE_NAME"
echo "'stock' table created or already exists."

echo "7. Creating 'orders' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`orders\` (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_number INT NOT NULL,
    order_date DATE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50),
    FOREIGN KEY (customer_number) REFERENCES customer_details(customer_number)
);
" "$DATABASE_NAME"
echo "'orders' table created or already exists."

echo "8. Creating 'order_items' table in '$DATABASE_NAME'."
execute_mysql_command "
CREATE TABLE IF NOT EXISTS \`order_items\` (
    order_item_id INT AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_at_order DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (order_item_id),
    UNIQUE (order_id, product_id), -- Composite unique key to ensure one product per order
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);
" "$DATABASE_NAME"
echo "'order_items' table created or already exists."


echo "9. Inserting sample data into 'customer_details'."
execute_mysql_command "
INSERT IGNORE INTO \`customer_details\` (customer_name, customer_address, bank_sort_code, bank_account_number, bank_name) VALUES
('Alice Smith', '123 Main St, Anytown, USA', '112233', '1234567890', 'First National Bank'),
('Bob Johnson', '456 Oak Ave, Otherville, USA', '445566', '0987654321', 'Community Credit Union'),
('Charlie Brown', '789 Pine Ln, Somewhere, USA', '778899', '1122334455', 'Global Bank'),
('Diana Miller', '101 Elm St, Villagetown, USA', '223344', '2345678901', 'City Bank'),
('Eve Davis', '202 Birch Ave, Hamletville, USA', '556677', '3456789012', 'Rural Credit'),
('Frank White', '303 Cedar Rd, Boroughburg, USA', '889900', '4567890123', 'National Trust'),
('Grace Green', '404 Pine St, Metropolis, USA', '121212', '5678901234', 'MegaCorp Bank'),
('Henry Black', '505 Oak St, Capital City, USA', '343434', '6789012345', 'State Bank');
" "$DATABASE_NAME"
echo "Sample data inserted into 'customer_details'."

echo "10. Inserting sample data into 'invoice'."
# Fetch customer numbers dynamically
CUSTOMER_ALICE=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Alice Smith';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_BOB=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Bob Johnson';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_CHARLIE=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Charlie Brown';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_DIANA=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Diana Miller';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_EVE=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Eve Davis';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_FRANK=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Frank White';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_GRACE=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Grace Green';" "$DATABASE_NAME" | tail -n 1)
CUSTOMER_HENRY=$(execute_mysql_command "SELECT customer_number FROM customer_details WHERE customer_name='Henry Black';" "$DATABASE_NAME" | tail -n 1)

execute_mysql_command "
INSERT INTO \`invoice\` (customer_number, invoice_date, amount, status) VALUES
(${CUSTOMER_ALICE}, '2024-01-15', 150.75, 'Paid'),
(${CUSTOMER_BOB}, '2024-02-01', 200.00, 'Pending'),
(${CUSTOMER_ALICE}, '2024-03-10', 75.20, 'Paid'),
(${CUSTOMER_CHARLIE}, '2024-04-05', 300.50, 'Overdue'),
(${CUSTOMER_DIANA}, '2024-05-12', 120.00, 'Paid'),
(${CUSTOMER_EVE}, '2024-06-18', 50.00, 'Pending'),
(${CUSTOMER_FRANK}, '2024-07-22', 450.99, 'Paid'),
(${CUSTOMER_GRACE}, '2024-08-01', 99.99, 'Pending'),
(${CUSTOMER_HENRY}, '2024-09-05', 250.00, 'Paid'),
(${CUSTOMER_BOB}, '2024-10-10', 180.50, 'Paid'),
(${CUSTOMER_ALICE}, '2024-11-15', 320.00, 'Pending'),
(${CUSTOMER_CHARLIE}, '2024-12-20', 60.00, 'Paid');
" "$DATABASE_NAME"
echo "Sample data inserted into 'invoice'."

echo "11. Inserting sample data into 'suppliers'."
execute_mysql_command "
INSERT IGNORE INTO \`suppliers\` (supplier_name, contact_person, phone, email, address) VALUES
('Global Supplies Inc.', 'John Doe', '555-1001', 'john.doe@globalsupplies.com', '10 Main St, Supply City'),
('Tech Components Ltd.', 'Jane Smith', '555-1002', 'jane.smith@techcomp.com', '20 Tech Rd, Innovation Hub'),
('Wholesale Goods Co.', 'Mike Brown', '555-1003', 'mike.brown@wholesalegoods.com', '30 Market Ln, Commerce Town'),
('Industrial Parts LLC', 'Sarah Green', '555-1004', 'sarah.green@industrialparts.com', '40 Factory Ave, Mfg District'),
('Office Essentials', 'David Lee', '555-1005', 'david.lee@officeessentials.com', '50 Business Blvd, Corpville');
" "$DATABASE_NAME"
echo "Sample data inserted into 'suppliers'."

echo "12. Inserting sample data into 'products'."
# Fetch supplier IDs dynamically
SUPPLIER_GLOBAL=$(execute_mysql_command "SELECT supplier_id FROM suppliers WHERE supplier_name='Global Supplies Inc.';" "$DATABASE_NAME" | tail -n 1)
SUPPLIER_TECH=$(execute_mysql_command "SELECT supplier_id FROM suppliers WHERE supplier_name='Tech Components Ltd.';" "$DATABASE_NAME" | tail -n 1)
SUPPLIER_WHOLESALE=$(execute_mysql_command "SELECT supplier_id FROM suppliers WHERE supplier_name='Wholesale Goods Co.';" "$DATABASE_NAME" | tail -n 1)
SUPPLIER_INDUSTRIAL=$(execute_mysql_command "SELECT supplier_id FROM suppliers WHERE supplier_name='Industrial Parts LLC';" "$DATABASE_NAME" | tail -n 1)
SUPPLIER_OFFICE=$(execute_mysql_command "SELECT supplier_id FROM suppliers WHERE supplier_name='Office Essentials';" "$DATABASE_NAME" | tail -n 1)

execute_mysql_command "
INSERT IGNORE INTO \`products\` (product_name, description, unit_price, supplier_id) VALUES
('Laptop Pro X', 'High-performance laptop for professionals', 1200.00, ${SUPPLIER_TECH}),
('Wireless Mouse', 'Ergonomic wireless mouse', 25.50, ${SUPPLIER_OFFICE}),
('Mechanical Keyboard', 'RGB mechanical gaming keyboard', 90.00, ${SUPPLIER_OFFICE}),
('SSD 1TB', 'Solid State Drive 1TB', 85.00, ${SUPPLIER_TECH}),
('Monitor 27-inch', 'Full HD 27-inch monitor', 180.00, ${SUPPLIER_TECH}),
('USB-C Hub', '7-in-1 USB-C Multiport Adapter', 45.00, ${SUPPLIER_OFFICE}),
('Ethernet Cable 10m', 'Cat6 Ethernet Cable 10 meters', 10.20, ${SUPPLIER_GLOBAL}),
('Server Rack Unit', 'Standard 42U server rack', 500.00, ${SUPPLIER_INDUSTRIAL}),
('Network Switch 24-port', 'Managed 24-port Gigabit switch', 350.00, ${SUPPLIER_INDUSTRIAL}),
('Security Camera 1080p', 'Outdoor 1080p security camera', 75.00, ${SUPPLIER_GLOBAL}),
('Power Supply 750W', 'Modular 80+ Gold Power Supply', 110.00, ${SUPPLIER_TECH}),
('HDMI Cable 2m', 'High-speed HDMI cable 2 meters', 8.50, ${SUPPLIER_GLOBAL}),
('Office Chair Ergonomic', 'Adjustable ergonomic office chair', 220.00, ${SUPPLIER_OFFICE}),
('Desk Lamp LED', 'LED desk lamp with dimming', 35.00, ${SUPPLIER_OFFICE}),
('Printer Laser Mono', 'Monochrome laser printer', 150.00, ${SUPPLIER_OFFICE}),
('External HDD 4TB', 'USB 3.0 External Hard Drive 4TB', 100.00, ${SUPPLIER_TECH}),
('Router Wi-Fi 6', 'Dual-band Wi-Fi 6 router', 130.00, ${SUPPLIER_GLOBAL}),
('UPS 1500VA', 'Uninterruptible Power Supply 1500VA', 280.00, ${SUPPLIER_INDUSTRIAL}),
('Barcode Scanner', 'USB Handheld Barcode Scanner', 60.00, ${SUPPLIER_WHOLESALE}),
('Label Printer', 'Thermal Label Printer', 95.00, ${SUPPLIER_WHOLESALE});
" "$DATABASE_NAME"
echo "Sample data inserted into 'products'."

echo "13. Inserting sample data into 'stock'."
# Fetch product IDs dynamically
PRODUCT_LAPTOP=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Laptop Pro X';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_MOUSE=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Wireless Mouse';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_KEYBOARD=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Mechanical Keyboard';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_SSD=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='SSD 1TB';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_MONITOR=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Monitor 27-inch';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_USBCHUB=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='USB-C Hub';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_ETHERNET=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Ethernet Cable 10m';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_SERVERRACK=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Server Rack Unit';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_NETSWITCH=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Network Switch 24-port';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_SECCAMERA=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Security Camera 1080p';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_POWERSUPPLY=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Power Supply 750W';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_HDMICABLE=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='HDMI Cable 2m';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_OFFICECHAIR=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Office Chair Ergonomic';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_DESKLAMP=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Desk Lamp LED';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_PRINTER=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Printer Laser Mono';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_EXTHDD=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='External HDD 4TB';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_ROUTER=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Router Wi-Fi 6';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_UPS=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='UPS 1500VA';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_BARCODESCANNER=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Barcode Scanner';" "$DATABASE_NAME" | tail -n 1)
PRODUCT_LABELPRINTER=$(execute_mysql_command "SELECT product_id FROM products WHERE product_name='Label Printer';" "$DATABASE_NAME" | tail -n 1)

execute_mysql_command "
INSERT IGNORE INTO \`stock\` (product_id, quantity_on_hand) VALUES
(${PRODUCT_LAPTOP}, 15),
(${PRODUCT_MOUSE}, 100),
(${PRODUCT_KEYBOARD}, 30),
(${PRODUCT_SSD}, 50),
(${PRODUCT_MONITOR}, 20),
(${PRODUCT_USBCHUB}, 75),
(${PRODUCT_ETHERNET}, 200),
(${PRODUCT_SERVERRACK}, 5),
(${PRODUCT_NETSWITCH}, 10),
(${PRODUCT_SECCAMERA}, 40),
(${PRODUCT_POWERSUPPLY}, 25),
(${PRODUCT_HDMICABLE}, 150),
(${PRODUCT_OFFICECHAIR}, 12),
(${PRODUCT_DESKLAMP}, 60),
(${PRODUCT_PRINTER}, 8),
(${PRODUCT_EXTHDD}, 35),
(${PRODUCT_ROUTER}, 18),
(${PRODUCT_UPS}, 7),
(${PRODUCT_BARCODESCANNER}, 22),
(${PRODUCT_LABELPRINTER}, 10);
" "$DATABASE_NAME"
echo "Sample data inserted into 'stock'."

echo "14. Inserting sample data into 'orders'."
execute_mysql_command "
INSERT INTO \`orders\` (customer_number, order_date, total_amount, status) VALUES
(${CUSTOMER_ALICE}, '2024-01-20', 1225.50, 'Completed'),
(${CUSTOMER_BOB}, '2024-02-05', 210.20, 'Pending'),
(${CUSTOMER_CHARLIE}, '2024-03-15', 400.00, 'Completed'),
(${CUSTOMER_DIANA}, '2024-04-22', 180.00, 'Processing'),
(${CUSTOMER_EVE}, '2024-05-01', 95.00, 'Completed'),
(${CUSTOMER_FRANK}, '2024-06-10', 550.00, 'Pending'),
(${CUSTOMER_GRACE}, '2024-07-03', 145.00, 'Completed'),
(${CUSTOMER_HENRY}, '2024-08-11', 300.00, 'Processing'),
(${CUSTOMER_ALICE}, '2024-09-01', 75.00, 'Completed'),
(${CUSTOMER_BOB}, '2024-10-08', 110.00, 'Pending'),
(${CUSTOMER_CHARLIE}, '2024-11-19', 220.00, 'Completed'),
(${CUSTOMER_DIANA}, '2024-12-25', 50.00, 'Processing'),
(${CUSTOMER_EVE}, '2025-01-05', 10.20, 'Completed'),
(${CUSTOMER_FRANK}, '2025-02-14', 350.00, 'Pending'),
(${CUSTOMER_GRACE}, '2025-03-01', 75.00, 'Completed'),
(${CUSTOMER_HENRY}, '2025-04-10', 150.00, 'Processing'),
(${CUSTOMER_ALICE}, '2025-05-01', 25.50, 'Completed'),
(${CUSTOMER_BOB}, '2025-06-07', 90.00, 'Pending'),
(${CUSTOMER_CHARLIE}, '2025-07-12', 85.00, 'Completed'),
(${CUSTOMER_DIANA}, '2025-07-15', 180.00, 'Processing');
" "$DATABASE_NAME"
echo "Sample data inserted into 'orders'."

echo "15. Inserting sample data into 'order_items'."
# Fetch order IDs and product IDs dynamically
# This is more complex as we need specific orders and products.
# We'll create a few typical orders.

# Order 1 (Alice, 2024-01-20, Laptop Pro X, Wireless Mouse)
ORDER_1_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_ALICE} AND order_date='2024-01-20';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_1_ID}, ${PRODUCT_LAPTOP}, 1, 1200.00),
(${ORDER_1_ID}, ${PRODUCT_MOUSE}, 1, 25.50);
" "$DATABASE_NAME"

# Order 2 (Bob, 2024-02-05, Ethernet Cable, HDMI Cable)
ORDER_2_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_BOB} AND order_date='2024-02-05';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_2_ID}, ${PRODUCT_ETHERNET}, 10, 10.20),
(${ORDER_2_ID}, ${PRODUCT_HDMICABLE}, 1, 8.50);
" "$DATABASE_NAME"

# Order 3 (Charlie, 2024-03-15, SSD 1TB, Monitor 27-inch)
ORDER_3_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_CHARLIE} AND order_date='2024-03-15';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_3_ID}, ${PRODUCT_SSD}, 2, 85.00),
(${ORDER_3_ID}, ${PRODUCT_MONITOR}, 1, 180.00);
" "$DATABASE_NAME"

# Order 4 (Diana, 2024-04-22, USB-C Hub, Desk Lamp)
ORDER_4_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_DIANA} AND order_date='2024-04-22';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_4_ID}, ${PRODUCT_USBCHUB}, 2, 45.00),
(${ORDER_4_ID}, ${PRODUCT_DESKLAMP}, 1, 35.00);
" "$DATABASE_NAME"

# Order 5 (Eve, 2024-05-01, Mechanical Keyboard)
ORDER_5_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_EVE} AND order_date='2024-05-01';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_5_ID}, ${PRODUCT_KEYBOARD}, 1, 90.00);
" "$DATABASE_NAME"

# Order 6 (Frank, 2024-06-10, Server Rack Unit, Network Switch)
ORDER_6_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_FRANK} AND order_date='2024-06-10';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_6_ID}, ${PRODUCT_SERVERRACK}, 1, 500.00),
(${ORDER_6_ID}, ${PRODUCT_NETSWITCH}, 1, 350.00);
" "$DATABASE_NAME"

# Order 7 (Grace, 2024-07-03, Security Camera)
ORDER_7_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_GRACE} AND order_date='2024-07-03';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_7_ID}, ${PRODUCT_SECCAMERA}, 1, 75.00);
" "$DATABASE_NAME"

# Order 8 (Henry, 2024-08-11, Power Supply)
ORDER_8_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_HENRY} AND order_date='2024-08-11';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_8_ID}, ${PRODUCT_POWERSUPPLY}, 1, 110.00);
" "$DATABASE_NAME"

# Order 9 (Alice, 2024-09-01, Barcode Scanner)
ORDER_9_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_ALICE} AND order_date='2024-09-01';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_9_ID}, ${PRODUCT_BARCODESCANNER}, 1, 60.00);
" "$DATABASE_NAME"

# Order 10 (Bob, 2024-10-08, Label Printer)
ORDER_10_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_BOB} AND order_date='2024-10-08';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_10_ID}, ${PRODUCT_LABELPRINTER}, 1, 95.00);
" "$DATABASE_NAME"

# Order 11 (Charlie, 2024-11-19, Office Chair Ergonomic)
ORDER_11_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_CHARLIE} AND order_date='2024-11-19';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_11_ID}, ${PRODUCT_OFFICECHAIR}, 1, 220.00);
" "$DATABASE_NAME"

# Order 12 (Diana, 2024-12-25, HDMI Cable 2m)
ORDER_12_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_DIANA} AND order_date='2024-12-25';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_12_ID}, ${PRODUCT_HDMICABLE}, 5, 8.50);
" "$DATABASE_NAME"

# Order 13 (Eve, 2025-01-05, Ethernet Cable 10m)
ORDER_13_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_EVE} AND order_date='2025-01-05';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_13_ID}, ${PRODUCT_ETHERNET}, 1, 10.20);
" "$DATABASE_NAME"

# Order 14 (Frank, 2025-02-14, Network Switch 24-port)
ORDER_14_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_FRANK} AND order_date='2025-02-14';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_14_ID}, ${PRODUCT_NETSWITCH}, 1, 350.00);
" "$DATABASE_NAME"

# Order 15 (Grace, 2025-03-01, Security Camera 1080p)
ORDER_15_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_GRACE} AND order_date='2025-03-01';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_15_ID}, ${PRODUCT_SECCAMERA}, 1, 75.00);
" "$DATABASE_NAME"

# Order 16 (Henry, 2025-04-10, Printer Laser Mono)
ORDER_16_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_HENRY} AND order_date='2025-04-10';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_16_ID}, ${PRODUCT_PRINTER}, 1, 150.00);
" "$DATABASE_NAME"

# Order 17 (Alice, 2025-05-01, Wireless Mouse)
ORDER_17_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_ALICE} AND order_date='2025-05-01';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_17_ID}, ${PRODUCT_MOUSE}, 1, 25.50);
" "$DATABASE_NAME"

# Order 18 (Bob, 2025-06-07, Mechanical Keyboard)
ORDER_18_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_BOB} AND order_date='2025-06-07';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_18_ID}, ${PRODUCT_KEYBOARD}, 1, 90.00);
" "$DATABASE_NAME"

# Order 19 (Charlie, 2025-07-12, SSD 1TB)
ORDER_19_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_CHARLIE} AND order_date='2025-07-12';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_19_ID}, ${PRODUCT_SSD}, 1, 85.00);
" "$DATABASE_NAME"

# Order 20 (Diana, 2025-07-15, Monitor 27-inch)
ORDER_20_ID=$(execute_mysql_command "SELECT order_id FROM \`orders\` WHERE customer_number=${CUSTOMER_DIANA} AND order_date='2025-07-15';" "$DATABASE_NAME" | tail -n 1)
execute_mysql_command "
INSERT INTO \`order_items\` (order_id, product_id, quantity, price_at_order) VALUES
(${ORDER_20_ID}, ${PRODUCT_MONITOR}, 1, 180.00);
" "$DATABASE_NAME"

echo "Sample data inserted into 'order_items'."

echo "--- Database setup complete! ---"
echo "You can now connect to MySQL database '$DATABASE_NAME' and explore the tables."
