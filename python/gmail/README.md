# Email Auto Responder

Automate email responses for a Gmail account. This script reads unread emails, analyzes their content using a large language model (LLM), and creates draft replies in Gmail for your review.

## Prerequisites

- Python 3.6 or higher
- A Google account

## Setup

Follow these steps to set up the project and install dependencies in a virtual environment.

### 1. Create a virtual environment

```bash
python3 -m venv .venv
```

### 2. Activate the virtual environment

**macOS/Linux:**
```bash
source .venv/bin/activate
```

**Windows:**
```powershell
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install requests google-api-python-client google-auth-oauthlib google-auth-httplib2
```

## Google API Credentials Setup

This script requires a `credentials.json` file to authenticate with the Gmail API.

1. **Go to [Google Cloud Console](https://console.cloud.google.com/) and log in.**
2. **Create a new project:**  
    Click the project dropdown > "New Project" > Name it > "Create".
3. **Enable Gmail API:**  
    Search for "Gmail API" > Select > "Enable".
4. **Configure OAuth consent screen:**  
    APIs & Services > OAuth consent screen > User Type: "External" > "Create" > Fill required info > "Save and Continue".
5. **Create credentials:**  
    APIs & Services > Credentials > "Create Credentials" > "OAuth client ID" > Application type: "Desktop app" > Name it > "Create".
6. **Download `credentials.json`:**  
    Click "Download JSON" and place the file in the same directory as the script.
7. Set the App to Production or Publish it to allow people to use it

## How to Run

After setup, run the script from your terminal, providing the Gmail address to process:

```bash
python auto_responder.py --user your.email@gmail.com
```

On first run, a browser window will prompt you to log in and grant permissions. A `token_your.email@gmail.com.json` file will be created for future runs, so re-authentication won't be needed.