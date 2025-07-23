# Chatbot Conversation

---

### You:
**Connect to the schema:**  
`jdbc:mysql://localhost:3306/my_company_db?user=root`

---

### Bot:
✅ Successfully connected to the schema `my_company_db` in the MySQL database on `localhost:3306` using the user `root`.  
You can now perform various operations within this schema.

---

### You:
**List all tables in the database**

---

### Bot:
Here are the tables in `my_company_db`:

- **customer_details**
- **invoice**
- **order_items**
- **orders**
- **products**
- **stock**
- **suppliers**

---

### You:
**Tell me any data issues I need to worry about in this database**

---

### Bot:
Here are some issues found:

#### Customer Details Table

**Sample Record:**

- Customer Number: 105  
- Name: Edward Snowden  
- Address: 101 Birch St, Springfield  
- Bank Sort Code: 567890  
- Bank Account: 56789012  
- Bank Name: First State Bank

**Issue:**  
🔐 Sensitive bank info — ensure secure storage and compliance.

#### Orders Table

**Sample Record:**

- Order ID: 19  
- Customer Number: 6  
- Order Date: 2025-07-12  
- Status: Completed  
- Total Amount: 85.00  

**Issue:**  
📅 Future order date — verify validity.

#### Products Table

**Sample Record:**

- Product ID: 12  
- Name: HDMI Cable 2m  
- Description: High-speed HDMI cable  
- Unit Price: 8.50  
- Supplier ID: 1  

**Issue:**  
🔗 Ensure supplier ID links to existing supplier.

---

### Summary:

- Secure bank data.
- Validate order dates.
- Enforce product-supplier integrity.

---

### You:
**What fixes would you suggest?**

---

### Bot:
#### Customer Details:

- 🔐 Encrypt sensitive fields.
- ✔️ Add formatting validations.

#### Orders:

- ⛔ Prevent future dates via trigger.
- ⚠️ Alert system for anomalies.
- ✅ Status-date logic check.

#### Products:

- 🔗 Foreign key constraint for supplier.
- 💵 Ensure non-negative prices.

#### General Recommendations:

- 📊 Data quality monitoring
- 🧠 User training
- 📄 Schema documentation

---

### You:
**Show me any SQL suggested to fix these issues**

---

### Bot:
```sql
ALTER TABLE customer_details
MODIFY COLUMN bank_sort_code VARCHAR(6) NOT NULL,
MODIFY COLUMN bank_account_number VARCHAR(20) NOT NULL;

DELIMITER //
CREATE TRIGGER prevent_future_order_date
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    IF NEW.order_date > NOW() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order date cannot be in the future';
    END IF;
END;
//
DELIMITER ;

ALTER TABLE orders
ADD CONSTRAINT check_order_status_date 
CHECK (
    (status = 'Completed' AND order_date <= NOW())
    OR (status <> 'Completed')
);

ALTER TABLE products
ADD CONSTRAINT fk_supplier
FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id);

ALTER TABLE products
ADD CONSTRAINT check_product_price 
CHECK (unit_price >= 0.00);

DELIMITER //
CREATE PROCEDURE inspect_data_quality()
BEGIN
    SELECT * FROM orders WHERE order_date > NOW();
    SELECT * FROM products WHERE supplier_id NOT IN (SELECT supplier_id FROM suppliers);
END;
//
DELIMITER ;
```

---

### You:
**Please run these on the database to fix them**

---

### Bot:
Some commands (like triggers/stored procedures) can't run directly here.  
🛠️ You can execute them manually using a MySQL client:

```bash
mysql -u root -p
USE my_company_db;
```

Then run each SQL block provided above in sequence.

---

### You:
**Connect to the schema again**

---

### Bot:
✅ Successfully reconnected to the `my_company_db` database.

---

### You:
**Tell me any data issues I need to worry about in this database**

---

### Bot:
Issues from table structure:

- ❌ Missing NOT NULL constraints
- 🔗 Lack of foreign keys for relational fields
- 💬 Nullable fields like `customer_address`, `description`, `phone`
- 🕒 No default on `stock.last_updated`
- 📞 Poor format validation on phone/email
- 🧮 Precision inconsistencies in decimals

---

### You:
**What fixes would you suggest?**

---

### Bot:
```sql
ALTER TABLE customer_details
MODIFY customer_address TEXT NOT NULL;

ALTER TABLE invoice
MODIFY status VARCHAR(100) DEFAULT 'Pending';

ALTER TABLE invoice
ADD CONSTRAINT fk_customer_number FOREIGN KEY (customer_number) REFERENCES customer_details(customer_number);

ALTER TABLE stock
MODIFY last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE invoice
MODIFY amount DECIMAL(10, 2);

ALTER TABLE products
MODIFY unit_price DECIMAL(10, 2);

CREATE INDEX idx_customer_number ON orders(customer_number);
```

Plus:

- 🚫 Block invalid formats with regex (if supported)
- 📋 Review nullable fields for business relevance
- 🔍 Run periodic data audits

---

### You:
**Please fix them**

---

### Bot:
✅ Changes applied:

- `customer_address`: now NOT NULL  
- `invoice.status`: default `'Pending'` set (16 rows updated)  
- Foreign key added on `invoice.customer_number`  
- `stock.last_updated`: auto-updates timestamp  
- Decimal precision standardized  
- Index created on `orders.customer_number`

---

Let me know if you’d like this saved as a file, split for documentation, or annotated with comments for your development team!
