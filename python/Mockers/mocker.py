import json
import random
from datetime import datetime, timedelta
from faker import Faker

def generate_mock_data():
    """
    Generates a mock JSON dataset for an energy supplier based on the provided schema.

    The script creates 50 customers with a payment, invoice, and meter reading history
    ranging from 2 months to 5 years. It includes a mix of "good paying" and
    "problematic" customers to provide a realistic testing dataset.
    """
    
    # Initialize Faker for generating realistic-looking data
    fake = Faker('en_GB')  # Use a locale that fits the requested data (e.g., UK)

    # Define the number of customers to generate
    NUM_CUSTOMERS = 50

    # Define the range for customer history
    MIN_HISTORY_MONTHS = 2
    MAX_HISTORY_MONTHS = 60 # 5 years
    
    # Initialize lists to hold the generated data
    customers = []
    accounts = []
    invoices = []
    payments = []
    meter_readings = []
    delinquent_customers = []

    for i in range(NUM_CUSTOMERS):
        customer_id = str(fake.uuid4())
        
        # Determine if the customer is "good" or "problematic"
        is_problematic = random.random() < 0.2  # 20% chance of being problematic

        # Generate customer details
        customer_data = {
            "customer_id": customer_id,
            "name": fake.name(),
            "address": fake.address(),
            "contact_details": {
                "email": fake.email(),
                "phone": fake.phone_number()
            }
        }
        customers.append(customer_data)

        # Generate account details
        payment_type = random.choice(["Credit Card", "Bank Transfer"])
        account_data = {
            "account_id": str(fake.uuid4()),
            "customer_id": customer_id,
            "payment_details": {
                "type": payment_type,
                "card_number": fake.credit_card_number() if payment_type == "Credit Card" else None,
                "expiry_date": fake.credit_card_expire(date_format='%m/%y') if payment_type == "Credit Card" else None,
                "bank_name": fake.bank_country() if payment_type == "Bank Transfer" else None,
                "account_number": fake.bban() if payment_type == "Bank Transfer" else None,
                "sort_code": fake.ssn() if payment_type == "Bank Transfer" else None
            }
        }
        accounts.append(account_data)

        # Generate history for the customer (invoices, payments, meter readings)
        history_months = random.randint(MIN_HISTORY_MONTHS, MAX_HISTORY_MONTHS)
        start_date = datetime.now() - timedelta(days=history_months * 30)
        
        delinquent_invoices = []
        for month in range(history_months):
            issue_date = start_date + timedelta(days=month * 30)
            due_date = issue_date + timedelta(days=21)
            
            # Simulate a range of energy usage
            energy_used = round(random.uniform(100, 5000), 2)
            unit_price = random.uniform(0.15, 0.25) # Mock price per kWh
            amount_due = round(energy_used * unit_price, 2)
            
            invoice_id = str(fake.uuid4())
            
            invoice_status = "Pending"
            if is_problematic and random.random() < 0.3: # Problematic customer has a 30% chance to have overdue invoices
                if month == history_months - 1:
                    # The most recent invoice for problematic customers is overdue
                    invoice_status = "Overdue"
                else:
                    # Simulate some overdue invoices for problem customers
                    invoice_status = random.choice(["Overdue", "In Arrears"])
            else:
                # Good customer, invoice is most likely paid
                invoice_status = "Paid"

            invoice_data = {
                "invoice_id": invoice_id,
                "customer_id": customer_id,
                "details": {
                    "issue_date": issue_date.strftime("%Y-%m-%d"),
                    "amount_due": amount_due,
                    "due_date": due_date.strftime("%Y-%m-%d"),
                    "start_date": (issue_date - timedelta(days=30)).strftime("%Y-%m-%d"),
                    "end_date": issue_date.strftime("%Y-%m-%d")
                },
                "status": invoice_status
            }
            invoices.append(invoice_data)
            
            # Generate payments only for 'Paid' invoices
            if invoice_status == "Paid":
                payment_date = issue_date + timedelta(days=random.randint(0, 20))
                payment_data = {
                    "payment_id": str(fake.uuid4()),
                    "customer_id": customer_id,
                    "invoice_id": invoice_id,
                    "amount_paid": amount_due,
                    "payment_date": payment_date.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                payments.append(payment_data)
            elif invoice_status in ["Overdue", "In Arrears"]:
                # If overdue, add it to the delinquent list
                delinquent_invoices.append({
                    "invoice_id": invoice_id,
                    "amount_due": amount_due,
                    "due_date": due_date.strftime("%Y-%m-%d")
                })

            # Generate meter reading for this period
            reading_date = issue_date - timedelta(days=1)
            meter_reading_data = {
                "meter_id": f"METER-{customer_id}",
                "customer_id": customer_id,
                "reading": random.randint(1000, 90000), # Mock reading value
                "reading_date": reading_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "energy_used_kwh": energy_used
            }
            meter_readings.append(meter_reading_data)
        
        # Add problematic customers to the delinquent_customers list
        if is_problematic and delinquent_invoices:
            delinquent_customers.append({
                "customer_id": customer_id,
                "delinquent_invoices": delinquent_invoices,
                "pursuit_status": random.choice(["First Notice Sent", "Final Notice Sent", "Account Suspended"])
            })

    # Assemble the final JSON object
    data = {
        "customers": customers,
        "accounts": accounts,
        "invoices": invoices,
        "payments": payments,
        "meter_readings": meter_readings,
        "delinquent_customers": delinquent_customers
    }
    
    return data

if __name__ == "__main__":
    # Generate the data and save it to a JSON file
    mock_data = generate_mock_data()
    with open("mock_data.json", "w") as f:
        json.dump(mock_data, f, indent=2)
    print("Mock data generated and saved to mock_data.json")