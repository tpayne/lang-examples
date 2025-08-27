import json
import random
from datetime import datetime, timedelta
from faker import Faker

def generate_mock_data():
    """
    Generates mock JSON datasets for an energy supplier, saving each major structure
    (customers, accounts, invoices, payments, meter_readings, delinquent_customers, it_emails)
    to its own file.
    """
    fake = Faker('en_GB')

    NUM_CUSTOMERS = 50
    NUM_IT_EMAILS = 50
    MIN_HISTORY_MONTHS = 2
    MAX_HISTORY_MONTHS = 60

    customers = []
    accounts = []
    invoices = []
    payments = []
    meter_readings = []
    delinquent_customers = []
    it_emails = []

    for i in range(NUM_CUSTOMERS):
        customer_id = str(fake.uuid4())
        is_problematic = random.random() < 0.2

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

        history_months = random.randint(MIN_HISTORY_MONTHS, MAX_HISTORY_MONTHS)
        start_date = datetime.now() - timedelta(days=history_months * 30)

        delinquent_invoices = []
        for month in range(history_months):
            issue_date = start_date + timedelta(days=month * 30)
            due_date = issue_date + timedelta(days=21)
            energy_used = round(random.uniform(100, 5000), 2)
            unit_price = random.uniform(0.15, 0.25)
            amount_due = round(energy_used * unit_price, 2)
            invoice_id = str(fake.uuid4())

            invoice_status = "Pending"
            if is_problematic and random.random() < 0.3:
                if month == history_months - 1:
                    invoice_status = "Overdue"
                else:
                    invoice_status = random.choice(["Overdue", "In Arrears"])
            else:
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
                delinquent_invoices.append({
                    "invoice_id": invoice_id,
                    "amount_due": amount_due,
                    "due_date": due_date.strftime("%Y-%m-%d")
                })

            reading_date = issue_date - timedelta(days=1)
            meter_reading_data = {
                "meter_id": f"METER-{customer_id}",
                "customer_id": customer_id,
                "reading": random.randint(1000, 90000),
                "reading_date": reading_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "energy_used_kwh": energy_used
            }
            meter_readings.append(meter_reading_data)

        if is_problematic and delinquent_invoices:
            delinquent_customers.append({
                "customer_id": customer_id,
                "delinquent_invoices": delinquent_invoices,
                "pursuit_status": random.choice(["First Notice Sent", "Final Notice Sent", "Account Suspended"])
            })

    it_issue_types = [
        "Login/Account Access Issue",
        "Windows OS Problem",
        "Disk Space Full",
        "Hardware Purchase Policy"
    ]
    email_sentiments = ["Professional", "Impatient", "Frustrated"]

    for j in range(NUM_IT_EMAILS):
        issue_type = random.choice(it_issue_types)
        sentiment = random.choice(email_sentiments)
        email_sender = fake.email()
        email_recipient = "it-support@example.com"
        email_date = fake.date_time_between(start_date='-1y', end_date='now')

        subject = ""
        body = ""

        if issue_type == "Login/Account Access Issue":
            if sentiment == "Professional":
                subject = f"Query: Login Issue"
                body = f"""Hello IT Support,

I am writing to report an issue with my account access. I am unable to log in, and the password reset tool is not working as expected. My username is {fake.user_name()}. Could you please look into this matter at your earliest convenience?

Thank you,
{fake.name()}"""
            elif sentiment == "Impatient":
                subject = f"Still can't log in! Account Access Issue"
                body = f"""Hello,

I've been trying to log in all morning, but my account ({fake.user_name()}) is still locked. I need access to my files immediately to meet a deadline. Please resolve this as soon as possible.

Thanks,
{fake.name()}"""
            else:
                subject = f"URGENT: THIS IS UNACCEPTABLE. I CAN'T ACCESS MY ACCOUNT."
                body = f"""I have been completely locked out of my account for hours now, and my requests for help have gone unanswered. I am losing valuable work time. This needs to be fixed RIGHT NOW. Why isn't anyone responding?!

Sent from my iPhone"""

        elif issue_type == "Windows OS Problem":
            if sentiment == "Professional":
                subject = f"Windows OS Error Report"
                body = f"""Hi Team,

I'm experiencing a recurring issue with my Windows OS. A system error message appears, stating "{fake.catch_phrase()}", followed by a system freeze. I have attached a screenshot for your reference.

Please advise on the next steps.

Best regards,
{fake.name()}"""
            elif sentiment == "Impatient":
                subject = f"Fix my computer please."
                body = f"""My Windows computer is acting up again and keeps freezing. I'm getting an error message that says "{fake.catch_phrase()}". This has been happening for a few days. Can someone please help me get this resolved?

{fake.name()}"""
            else:
                subject = f"MY PC IS UNUSABLE. GET SOMEONE TO HELP ME NOW."
                body = f"""I cannot get any work done. My computer crashes every five minutes with a "{fake.catch_phrase()}" error. This is ridiculous. I need a solution immediately.

{fake.name()}"""

        elif issue_type == "Disk Space Full":
            if sentiment == "Professional":
                subject = f"Low Disk Space Notification"
                body = f"""Hello,

I have received a notification indicating that my local disk is nearing full capacity. I have reviewed my files but am unsure what to safely remove. Could you please provide guidance on freeing up disk space?

Thank you for your time,
{fake.name()}"""
            elif sentiment == "Impatient":
                subject = f"Urgent: My C Drive is Full"
                body = f"""My C drive is almost full, and it's slowing down my machine. What can I do to fix this quickly? Please let me know what my options are.

{fake.name()}"""
            else:
                subject = f"FIX MY COMPUTER. DISK SPACE IS ZERO."
                body = f"""I literally have zero disk space left and my computer is completely frozen. I can't even open a program. Why do we not have more storage?? This is insane! Fix this now.

{fake.name()}"""

        elif issue_type == "Hardware Purchase Policy":
            if sentiment == "Professional":
                subject = f"Query: Hardware Purchase Policy"
                body = f"""Hi IT,

I would like to inquire about the company's policy for purchasing new hardware, specifically regarding monitors. Could you please direct me to the appropriate documentation or process?

Thank you for your assistance,
{fake.name()}"""
            elif sentiment == "Impatient":
                subject = f"Need info on hardware policy"
                body = f"""I need to know the policy for buying hardware. How do I purchase a new keyboard? Can you just send me the form? I need this ASAP.

{fake.name()}"""
            else:
                subject = f"WHY IS IT SO HARD TO GET NEW HARDWARE?"
                body = f"""I've been trying to find information on the hardware policy for weeks and keep getting the runaround. All I need is a new headset. Is this a secret? Please provide the policy document immediately.

{fake.name()}"""

        email_data = {
            "email_id": str(fake.uuid4()),
            "subject": subject,
            "body": body,
            "sender": email_sender,
            "recipient": email_recipient,
            "timestamp": email_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sentiment": sentiment
        }
        it_emails.append(email_data)

    # Return all lists separately
    return {
        "customers": customers,
        "accounts": accounts,
        "invoices": invoices,
        "payments": payments,
        "meter_readings": meter_readings,
        "delinquent_customers": delinquent_customers,
        "it_emails": it_emails
    }

if __name__ == "__main__":
    data = generate_mock_data()

    # Save each major structure to its own file
    with open("customers.json", "w") as f:
        json.dump(data["customers"], f, indent=2)
    print("Customers data saved to customers.json")

    with open("accounts.json", "w") as f:
        json.dump(data["accounts"], f, indent=2)
    print("Accounts data saved to accounts.json")

    with open("invoices.json", "w") as f:
        json.dump(data["invoices"], f, indent=2)
    print("Invoices data saved to invoices.json")

    with open("payments.json", "w") as f:
        json.dump(data["payments"], f, indent=2)
    print("Payments data saved to payments.json")

    with open("meter_readings.json", "w") as f:
        json.dump(data["meter_readings"], f, indent=2)
    print("Meter readings data saved to meter_readings.json")

    with open("delinquent_customers.json", "w") as f:
        json.dump(data["delinquent_customers"], f, indent=2)
    print("Delinquent customers data saved to delinquent_customers.json")

    with open("it_emails.json", "w") as f:
        json.dump(data["it_emails"], f, indent=2)
    print("IT emails data saved to it_emails.json")
