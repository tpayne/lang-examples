# Sample Mock Data Generator

This repository contains a Python script and Docker setup for generating mock customer and email data for a commercial energy supplier. The data is created based on a provided JSON schema and includes a realistic mix of good and problematic customer profiles.

## 1. Project Setup

To use this project, you need to have **Docker** installed on your machine. All other dependencies, including Python and the necessary libraries, will be handled by the Docker container.

### Files Required

Ensure you have the following three files in the same directory:

* `Dockerfile`

* `mocker.py` (your Python script)

* `requirements.txt`

The `requirements.txt` file, which lists the Python packages needed, should contain the following content:

```
Faker==25.0.0

```

## 2. Running the Script with Docker

Using Docker ensures a consistent environment and prevents any dependency conflicts on your local machine.

### Step 1: Build the Docker Image

First, open your terminal and build the Docker image. This command will create a self-contained image named `python-tester` that includes everything needed to run your script.

```
docker build -t python-tester .

```

### Step 2: Run the Container

Next, run a container from the image. This command will execute your `mocker.py` script and, using a **volume mount**, save the generated `mock_data.json` and `it_emails.json` file directly to your local directory.

```
docker run -v $(pwd):/app python-tester

```

**How it works:**

* `docker run`: Creates and runs a new container.

* `-v $(pwd):/app`: This is the volume mount. `$(pwd)` gets your current working directory on your host machine and links it to the `/app` directory inside the container. This means any file created at `/app` (like your `mock_data.json`) will appear in your local directory.

## 3. Understanding the Mock Schemas

### Understanding the Customer Data Schema

The generated `mock_data.json` file is a single JSON object containing several top-level arrays, each representing a distinct entity. Understanding this structure will help you modify the schema or the script as needed.

* `customers`: Contains core customer information such as `customer_id`, `name`, `address`, and `contact_details`.

* `accounts`: Stores financial information, including the `account_id` and `payment_details` linked to a specific `customer_id`.

* `invoices`: A record of all bills generated, with details like `amount_due`, `due_date`, and `status` (e.g., `Paid`, `Overdue`).

* `payments`: Tracks all payments made, linking each payment to a specific `invoice_id`.

* `meter_readings`: Captures energy usage, including the `reading` value and `energy_used_kwh`.

* `delinquent_customers`: A specific array for customers with overdue invoices, detailing the status of debt pursuit.

### Email Schema

Each email entry in `it_emails.json` follows this schema:

* `email_id`: A unique identifier for the email.

* `subject`: The subject line of the email.

* `body`: The full text of the email.

* `sender`: The email address of the sender.

* `recipient`: The email address of the recipient (always `it-support@example.com` in this dataset).

* `timestamp`: The date and time the email was sent in ISO 8601 format.

* `sentiment`: The tone of the email, which can be **Professional**, **Impatient**, or **Frustrated**.

## 4. Modifying the Script

The `mocker.py` script is designed to be easily adjustable. You can change key parameters to control the output data.

### Adjusting the Number of Customers

To change the total number of customers generated, open `mocker.py` and modify the value of the `NUM_CUSTOMERS` variable at the top of the file:

```
NUM_CUSTOMERS = 50
NUM_IT_EMAILS = 50

```

### Modifying the Schema

If you need to add or remove fields from the JSON output, you'll need to make changes in two places:

1. **The Python Script (`mocker.py`)**: Find the relevant dictionary creation section (e.g., `customer_data` or `invoice_data`) and add or remove the key-value pairs to match your new schema.

2. **The JSON Schema (optional)**: If you were using a formal JSON schema file for validation, you would also update that file to reflect the changes.

For example, to add an `is_commercial` flag to the `customers` entity, you would modify the `customer_data` dictionary in your script:

```
customer_data = {
    "customer_id": customer_id,
    "name": fake.name(),
    "address": fake.address(),
    "contact_details": {
        "email": fake.email(),
        "phone": fake.phone_number()
    },
    "is_commercial": random.choice([True, False]) # New field
}

```

After any changes, simply rebuild and run your Docker container to generate the new data.
