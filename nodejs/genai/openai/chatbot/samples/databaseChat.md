# Chatbot Conversation

---

### You:
**Connect to the schema**  
`my_company_db` in the database  
`jdbc:mysql://localhost:3306/my_company_db?user=root`

---

### Bot:
✅ Successfully connected to the database `my_company_db`.  
You can now proceed with database operations or queries as needed.  
If you have any specific actions in mind, please let me know!

---

### You:
**What tables are in this schema?**

---

### Bot:
The following tables are present in the schema `my_company_db`:

- **customer_details**
- **invoice**
- **order_items**
- **orders**
- **products**
- **stock**
- **suppliers**

If you need further information about any of these tables, please let me know!

---

### You:
**Analyse this schema for tables and columns that have potential PII information in them that need masking. Just tell me the table (column) name and a one-line summary why it needs masking.**

---

### Bot:
Here’s the analysis of the tables in the `my_company_db` schema that contain potential Personally Identifiable Information (PII) requiring masking:

- `customer_details (customer_name)` — Contains the customer's name, which can be used to identify individuals.
- `customer_details (customer_address)` — Contains the physical address of the customer, which can be used to locate and identify them.
- `customer_details (bank_sort_code)` — Contains bank details used for financial identification and transactions.
- `customer_details (bank_account_number)` — Sensitive bank account info linked to financial assets.
- `suppliers (contact_person)` — Identifies a person associated with a supplier.
- `suppliers (phone)` — Contains the contact person’s phone number, enabling direct communication.
- `suppliers (email)` — Contains the contact person’s email address.

These fields should be masked to protect customer and employee privacy and ensure compliance with data protection regulations.

---

### You:
**Does this database and the data in it have any data quality issues I need to be worried about?**

---

### Bot:
Here are the potential data quality issues identified in the database:

#### 1. `customer_details`

- **Duplicates** — Identical records detected, such as multiple entries for "Alice Smith" with matching details.
- **Missing Data** — No missing values reported, but bank details should be monitored to avoid nulls.

#### 2. `orders`

- **Missing Status** — The `status` field may contain null or empty values.
- **Customer Number Validity** — Customer numbers must map to valid records in `customer_details`.

#### 3. `suppliers`

- **Missing Contact Info** — Fields like `contact_person`, `phone`, and `email` can be null, which hampers communication.

#### Summary:

- ✔️ Deduplicate records in `customer_details`.
- 📋 Ensure key fields aren’t null.
- 🔗 Verify foreign key integrity between `orders` and `customer_details`.

---

### You:
**Can you create SQL scripts to fix these issues?**

---

### Bot:

#### 1. Remove duplicates from `customer_details`

```sql
DELETE c1
FROM customer_details c1
INNER JOIN customer_details c2
ON c1.customer_number > c2.customer_number
AND c1.customer_name = c2.customer_name
AND c1.customer_address = c2.customer_address
AND c1.bank_sort_code = c2.bank_sort_code
AND c1.bank_account_number = c2.bank_account_number
AND c1.bank_name = c2.bank_name;
```

#### 2. Ensure completeness in `customer_details`

```sql
UPDATE customer_details
SET bank_sort_code = 'UNKNOWN'
WHERE bank_sort_code IS NULL;

UPDATE customer_details
SET bank_account_number = 'UNKNOWN'
WHERE bank_account_number IS NULL;
```

#### 3. Validate `customer_number` in `orders`

```sql
DELETE FROM orders
WHERE customer_number NOT IN (
    SELECT customer_number FROM customer_details
);
```

#### 4. Ensure completeness in `orders`

```sql
UPDATE orders
SET status = 'Pending'
WHERE status IS NULL OR status = '';
```

#### 5. Ensure completeness in `suppliers`

```sql
UPDATE suppliers
SET contact_person = 'UNKNOWN'
WHERE contact_person IS NULL;

UPDATE suppliers
SET phone = 'UNKNOWN'
WHERE phone IS NULL;

UPDATE suppliers
SET email = 'UNKNOWN'
WHERE email IS NULL;
```

---

💡 *Execution Tip:* Always run these scripts in a test environment first. Back up the database before applying deletions or bulk updates.

---

Let me know if you want these bundled into a deployment-ready `.sql` file, or annotated with comments for easy onboarding!
