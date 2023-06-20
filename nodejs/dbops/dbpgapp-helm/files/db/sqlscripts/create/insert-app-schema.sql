--
-- This script will install a sample app schema
--
set schema 'demoapp';

-- Create sequence(s)
CREATE SEQUENCE IF NOT EXISTS app_sequence
    INCREMENT BY 1
    START WITh 1;

-- Create table(s)
CREATE TABLE IF NOT EXISTS customers (
    customer_uid    INTEGER NOT NULL DEFAULT nextval('app_sequence'),
    name            VARCHAR(25) NOT NULL,
    create_date     TIMESTAMP NOT NULL DEFAULT current_timestamp,
    update_date     TIMESTAMP NOT NULL DEFAULT current_timestamp,
    description     TEXT,
    CONSTRAINT customer_pk PRIMARY KEY (customer_uid),
    CONSTRAINT customer_k2 UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS stock_items (
    stock_uid       INTEGER NOT NULL DEFAULT nextval('app_sequence'),
    name            VARCHAR(25) NOT NULL,
    create_date     TIMESTAMP NOT NULL DEFAULT current_timestamp,
    update_date     TIMESTAMP NOT NULL DEFAULT current_timestamp,
    no_stock        INTEGER NOT NULL DEFAULT 0,
    description     TEXT,
    CONSTRAINT stock_pk PRIMARY KEY (stock_uid),
    CONSTRAINT stock_k2 UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS orders (
    order_uid       INTEGER NOT NULL DEFAULT nextval('app_sequence'),
    name            VARCHAR(25) NOT NULL,
    create_date     TIMESTAMP NOT NULL DEFAULT current_timestamp,
    update_date     TIMESTAMP NOT NULL DEFAULT current_timestamp,
    description     TEXT,
    CONSTRAINT order_pk PRIMARY KEY (order_uid),
    CONSTRAINT order_k2 UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS customer_orders (
    customer_uid    INTEGER NOT NULL REFERENCES customers(customer_uid) ON DELETE cascade,
    order_uid       INTEGER NOT NULL REFERENCES orders(order_uid) ON DELETE cascade,
    CONSTRAINT customer_orders_pk PRIMARY KEY (customer_uid,order_uid)
);

CREATE TABLE IF NOT EXISTS order_contents (
    order_uid       INTEGER NOT NULL REFERENCES orders(order_uid) ON DELETE cascade,
    stock_uid       INTEGER NOT NULL REFERENCES stock_items(stock_uid) ON DELETE cascade,
    no_ordered      INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT orders_contents_pk PRIMARY KEY (order_uid,stock_uid)
);

--
-- Distribute the tables
--
SELECT citus_add_local_table_to_metadata('customers', cascade_via_foreign_keys => 'true');
SELECT citus_add_local_table_to_metadata('stock_items', cascade_via_foreign_keys => 'true');
SELECT citus_add_local_table_to_metadata('orders', cascade_via_foreign_keys => 'true');
SELECT citus_add_local_table_to_metadata('customer_orders', cascade_via_foreign_keys => 'true');
SELECT citus_add_local_table_to_metadata('order_contents', cascade_via_foreign_keys => 'true');

SELECT create_reference_table('customers');
SELECT create_reference_table('stock_items');
SELECT create_reference_table('orders');
SELECT create_reference_table('customer_orders');
SELECT create_reference_table('order_contents');
--
-- Create quick views
--
CREATE OR REPLACE VIEW orders_in_progress(customer_name,order_name,stock_item,order_date,number_ordered) AS
SELECT a.name,b.name,d.name,b.create_date,e.no_ordered
FROM   customers a, orders b, customer_orders c, stock_items d, order_contents e
WHERE  b.order_uid = e.order_uid
AND    d.stock_uid = e.stock_uid
AND    b.order_uid = c.order_uid
AND    a.customer_uid = c.customer_uid
ORDER BY 1,2,3,4;

--
-- Insert data for app
--
INSERT INTO customers(name,description)
SELECT 'ACME','ACME Customer'
WHERE NOT EXISTS (SELECT 1 FROM customers a WHERE a.name = 'ACME')
UNION
SELECT 'LBG','LBG Customer'
WHERE NOT EXISTS (SELECT 1 FROM customers a WHERE a.name = 'LBG')
UNION
SELECT 'TSB','TSB Customer'
WHERE NOT EXISTS (SELECT 1 FROM customers a WHERE a.name = 'TSB');

INSERT INTO stock_items(name,description,no_stock)
SELECT 'TERM/001/MTU','MTU Series Terminal',2000
WHERE NOT EXISTS (SELECT 1 FROM stock_items a WHERE a.name = 'TERM/001/MTU')
UNION
SELECT 'GPU/001/MTU','MTU Series GPU',2000
WHERE NOT EXISTS (SELECT 1 FROM stock_items a WHERE a.name = 'GPU/001/MTU')
UNION
SELECT 'CPU/001/MTU','MTU Series CPU',2000
WHERE NOT EXISTS (SELECT 1 FROM stock_items a WHERE a.name = 'CPU/001/MTU');

INSERT INTO orders(name,description)
SELECT 'ORD001','Customer order'
WHERE NOT EXISTS (SELECT 1 FROM orders a WHERE a.name = 'ORD001')
UNION
SELECT 'ORD002','Customer order'
WHERE NOT EXISTS (SELECT 1 FROM orders a WHERE a.name = 'ORD002')
UNION
SELECT 'ORD003','Customer order'
WHERE NOT EXISTS (SELECT 1 FROM orders a WHERE a.name = 'ORD003');

INSERT INTO customer_orders(customer_uid,order_uid)
SELECT a.customer_uid,b.order_uid
FROM   customers a, orders b
WHERE  a.name = 'ACME'
EXCEPT
SELECT customer_uid,order_uid
FROM   customer_orders;

INSERT INTO order_contents(order_uid,stock_uid,no_ordered)
SELECT a.order_uid,b.stock_uid,10
FROM   customer_orders a, stock_items b
WHERE  b.name IN ('TERM/001/MTU','GPU/001/MTU')
EXCEPT
SELECT order_uid,stock_uid,no_ordered
FROM   order_contents;
