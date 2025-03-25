from types import ClassMethodDescriptorType
from typing import Any
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import os
import openai

aiBotClient = OpenAI()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)
ctxStr = "" # -> Any | Literal['Hello there! How can I help you?'] | Liter...:

def get_context(
    contextStr,
) -> str:
    with open("contexts/" + contextStr,"r") as f: s = f.read()
    return s
    
def get_chat_response(
    user_input,
) -> Any: 
    global ctxStr 
    """Simple placeholder for a chat model."""
    if "hello" in user_input.lower():
        return "Hello there! How can I help you?"
    elif "help" in user_input.lower():
        return "Help text"
    elif "bot-context" in user_input.lower():
        botCmd = user_input.split(' ')
        if botCmd[1] == "load":
            ctxStr= get_context(botCmd[2])
            if ctxStr == "":
                return "Context is empty - ignored"
            return "Context loaded"
        elif botCmd[1] == "show":
            if ctxStr == "":
                return "Context is empty - ignored"
            return ctxStr # type: ignore
        elif botCmd[1] == "reset":
            ctxStr = ""
            return "Context reset"
        else:
            return "Invalid command"
    else:
        try:
            response = aiBotClient.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": ctxStr},
                    {"role": "user", "context": user_input},
                ],
                temperature=1,
                max_tokens=1000,
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0,
            )
            return response
        except Exception as err:
            app.logger.error('Exception fired')
            if hasattr(err, 'message'):
                return(err.message)
            else:
                return(err)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json["message"]
    response = get_chat_response(user_input)
    return jsonify({"response": response})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
