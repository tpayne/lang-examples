from types import ClassMethodDescriptorType
from typing import Any
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import os
import sys
import openai
from jproperties import Properties

aiBotClient = OpenAI()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)
ctxStr = ""
config = Properties()


def load_properties(propFile) -> Any:
    global config
    try:
        with open(propFile, "rb") as config_file:
            config.load(config_file)
            return True
    except Exception as err:
        app.logger.error("Exception fired - Cannot load %s", propFile)
        return False


def get_context(
    contextStr,
) -> str:
    with open("contexts/" + contextStr, "r") as f:
        s = f.read()
    return s


def get_chat_response(
    user_input,
) -> Any:
    global ctxStr

    if "hello" in user_input.lower():
        return "Hello there! How can I help you?"
    elif "help" in user_input.lower():
        return "Help text"
    elif "bot-context" in user_input.lower():
        botCmd = user_input.split(" ")
        if botCmd[1] == "load":
            ctxStr = get_context(botCmd[2])
            if ctxStr == "":
                return "Context is empty - ignored"
            return "Context loaded"
        elif botCmd[1] == "show":
            if ctxStr == "":
                return "Context is empty - ignored"
            return ctxStr  # type: ignore
        elif botCmd[1] == "reset":
            ctxStr = ""
            return "Context reset"
        else:
            return "Invalid command"
    else:
        try:
            response = aiBotClient.chat.completions.create(
                model=config.get("gptModel").data,
                messages=[
                    {"role": "system", "content": ctxStr},
                    {"role": "user", "context": user_input},
                ],
                temperature=1,
                max_tokens=int(config.get("maxTokens").data),
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0,
            )
            return response
        except Exception as err:
            app.logger.error("Exception fired")
            if hasattr(err, "message"):
                return err.message
            else:
                return err


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json["message"]
    response = get_chat_response(user_input)
    return jsonify({"response": response})


if __name__ == "__main__":
    if load_properties("resources/app.properties"):
        # port = int(os.environ.get("PORT", 5000))
        port = int(config.get("port").data)
        app.logger.debug("Listening on port %d", port)
        app.run(debug=True, host="0.0.0.0", port=port)
        sys.exit(0)
    else:
        sys.exit(1)
