import os
import sys
import requests
import json
import logging
import base64
import argparse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

"""
This script automates email responses by reading new unread emails from a
specified Gmail account, using a large language model (LLM) to analyze
their content, and creating a draft reply for review.

To use this script, you must first set up Google API credentials:

1.  **Go to the Google Cloud Console**: Navigate to the Google Cloud Console
    at https://console.cloud.google.com/ and log in with the Google account
    you want the script to access.
2.  **Create a New Project**: At the top of the page, click on the project
    dropdown. In the pop-up, click "New Project," give it a name, and click
    "Create."
3.  **Enable the Gmail API**: In the search bar at the top, type "Gmail API" and
    select it from the results. On the API page, click the "Enable" button.
4.  **Configure the OAuth Consent Screen**: From the left-hand navigation menu,
    go to "APIs & Services" > "OAuth consent screen." Choose "External" as the
    User Type and click "Create." Fill out the required information, such as
    the "App name" and your email address. For a personal project, you can leave
    most fields as their defaults. Click "Save and Continue."
5.  **Create Credentials**: From the left-hand navigation menu, go to "APIs &
    Services" > "Credentials." Click "Create Credentials" at the top and select
    "OAuth client ID." For the "Application type," choose "Desktop app." Give
    your client a name (e.g., "Gmail Auto Responder") and click "Create."
6.  **Download `credentials.json`**: A dialog will appear with your client ID
    and client secret. Click the "Download JSON" button. The file will be saved
    as `credentials.json`. Place this downloaded file in the same directory as
    this script.

Once you have the `credentials.json` file, you can run the script from your
terminal, providing the email address of the account you want to process.

Example usage:
python auto_responder.py --user your.email@gmail.com
"""

# Configure logging for better visibility
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# The scopes required to access and modify your Gmail account.
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

# Path to the credentials file downloaded from Google Cloud Console.
CREDENTIALS_FILE = 'credentials.json'

def get_gmail_service(user_email):
    """
    Authenticates with the Gmail API and returns the service object.
    This function handles the OAuth 2.0 flow and token management. It
    creates a unique token file for each user to avoid conflicts.

    Args:
        user_email (str): The email address of the user to authenticate.

    Returns:
        googleapiclient.discovery.Resource: The authenticated Gmail service object.
    """
    token_file = f'token_{user_email}.json'
    creds = None
    
    # The token file stores the user's credentials
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open(token_file, 'w') as token:
            token.write(creds.to_json())

    service = build('gmail', 'v1', credentials=creds)
    return service

def get_llm_response(email_body):
    """
    Makes a call to the LLM API to analyze the email and draft a response.
    
    Args:
        email_body (str): The body of the email to analyze.

    Returns:
        dict: A dictionary containing the analysis and the draft body.
    """
    # NOTE: Replace "YOUR_API_KEY" with a secure method of handling your API key,
    # such as an environment variable.
    api_key = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY")
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [
                { "text": "Analyze the following email and draft a polite, professional response. The response should indicate how the issue or inquiry will be dealt with. The draft should be in Markdown format." },
                { "text": f"Email: {email_body}" }
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "analysis": { "type": "STRING" },
                    "draftBody": { "type": "STRING" }
                },
                "propertyOrdering": ["analysis", "draftBody"]
            }
        }
    }
    
    headers = {
        'Content-Type': 'application/json'
    }

    try:
        response = requests.post(api_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()  # Raise an exception for bad status codes
        
        result = response.json()
        candidate = result.get('candidates', [{}])[0]
        
        if candidate.get('content') and candidate['content'].get('parts') and candidate['content']['parts'][0].get('text'):
            return json.loads(candidate['content']['parts'][0]['text'])
        else:
            raise ValueError('LLM response format is unexpected or missing content.')

    except requests.exceptions.RequestException as e:
        logging.error(f"HTTP request failed: {e}")
        raise
    except (json.JSONDecodeError, ValueError) as e:
        logging.error(f"Failed to parse LLM response: {e}")
        raise

def read_and_respond_with_llm(user_email):
    """
    The main function to be triggered.
    It searches for new unread emails, uses an LLM to analyze the content,
    and creates a draft reply for review.

    Args:
        user_email (str): The email address of the user whose account to process.
    """
    service = get_gmail_service(user_email)
    
    # Get a list of unread message IDs
    try:
        response = service.users().messages().list(userId=user_email, q='is:unread').execute()
        messages = response.get('messages', [])
    except Exception as e:
        logging.error(f"Failed to retrieve unread messages: {e}")
        return

    if not messages:
        logging.info('No new unread emails found.')
        return

    for message in messages:
        try:
            msg_id = message['id']
            # Get the full message details
            full_msg = service.users().messages().get(userId=user_email, id=msg_id, format='full').execute()
            
            # Extract subject and sender
            headers = full_msg['payload']['headers']
            subject = next(header['value'] for header in headers if header['name'] == 'Subject')
            sender = next(header['value'] for header in headers if header['name'] == 'From')
            
            # Decode the email body (this is a simplified approach, real-world might need more)
            if 'parts' in full_msg['payload']:
                body_data = full_msg['payload']['parts'][0]['body']['data']
            else:
                body_data = full_msg['payload']['body']['data']
            email_body = base64.urlsafe_b64decode(body_data).decode('utf-8')
            
            logging.info(f"Processing email from '{sender}' with subject: '{subject}'")

            # Use the LLM to analyze and draft a response
            llm_response = get_llm_response(email_body)
            analysis = llm_response.get('analysis', '')
            draft_body = llm_response.get('draftBody', '')

            # Create the draft email
            message_body = {
                'raw': base64.urlsafe_b64encode(
                    f'To: {sender}\nSubject: Re: {subject}\n\n{draft_body}'.encode('utf-8')
                ).decode('utf-8')
            }
            
            service.users().drafts().create(userId=user_email, body={'message': message_body}).execute()
            
            # Mark the email as read
            service.users().messages().modify(userId=user_email, id=msg_id, body={'removeLabelIds': ['UNREAD']}).execute()

            logging.info(f"Draft email created and original message marked as read for: '{subject}'")
            logging.info(f"LLM Analysis: {analysis}")

        except Exception as e:
            logging.error(f"Failed to process message with ID {message.get('id', 'N/A')}: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Automate email responses for a specified Gmail user.')
    parser.add_argument('--user', type=str, required=True, help='The Gmail email address of the user to process.')
    args = parser.parse_args()

    read_and_respond_with_llm(args.user)
