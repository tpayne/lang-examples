from collections import OrderedDict
from flask import Flask, render_template, request, jsonify
from jproperties import Properties
from openai import OpenAI
from types import ClassMethodDescriptorType
from typing import Any, NoReturn, Optional

import re
import json
import logging
import openai
import os, signal
import sys
import traceback

aiBotClient = OpenAI()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)
ctxStr: str = ""
config = Properties()

#
# Add a response cache for bot responses to optimise speed & cost
#
msgCache = OrderedDict()

# Get key
def getKey(
        keyString
) -> str:
    key = re.sub('\W+','', keyString)
    return key.upper()

# Add response to cache and trim if needed
def addResponse(
        query,
        response
) -> bool:
    global msgCache
    keyStr: str = getKey(query)
    if keyStr in msgCache:
        return True
    if len(msgCache) > 1000:
        for k in range(len(msgCache) - 100): 
            msgCache.popitem(last = False)
    msgCache[keyStr] = response
    return True

# Get response from cache
def getResponse(
        query
) -> str:
    global msgCache
    keyStr: str = getKey(query)
    if keyStr in msgCache:
        app.logger.debug("Returning cached response for '%s'",
                          keyStr)
        return msgCache[keyStr]
    return ""

#
# Utility functions
#

# Signal handler for abnormal errors
def handler(signum, frame):
    signame= signal.Signals(signum).name
    app.logger.debug("Trapped signal %d", signum)
    sys.exit(1)

# Application property cache for key value pairs
def load_properties(propFile) -> bool:
    global config
    try:
        with open(propFile, "rb") as config_file:
            config.load(config_file)
            return True
    except Exception as err:
        app.logger.error("Exception fired - Cannot load %s", propFile)
        return False

#
# Context cache handler routines
#

# Read bot AI context rules from file
def read_context(
    contextStr,
) -> str:
    try:
        with open("contexts/" + contextStr, "r") as f:
            s = f.read()
        return s
    except Exception as err:
        return ""

# Main bot chat response routine
def get_chat_response(
    user_input,
    force_json=False,
) -> str:
    global ctxStr

    # Pre-canned responses
    if "hello" in user_input.lower():
        return "Hello there! How can I help you?"
    elif "help" in user_input.lower():
        return "Help text"
    elif "bot-context" in user_input.lower():
        # Context handling logic
        botCmd = user_input.split(" ")
        if botCmd[1] == "load":
            ctxStr = read_context(botCmd[2])
            if ctxStr == "":
                return "Context file could not be read or is empty"
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
        # NL OpenAI interface
        try:
            contxtStr: str = ctxStr
            responseMsg: str = ""

            if contxtStr == "":
                return "Error: Context is not set. Please load one"
            if force_json:
                contxtStr = contxtStr + f"\nYour response must be in json format."
            
            # Check cache to see if already processed this query
            responseMsg = getResponse(user_input)
            if responseMsg == "":
                # Get response from OpenAI model
                response = aiBotClient.chat.completions.create(
                    model=config.get("gptModel").data,
                    messages=[
                        {"role": "system", "content": contxtStr  },
                        {"role": "user", "content":   user_input },
                    ],
                    response_format={"type": "json_object"} if force_json else None,
                    timeout=120,               
                    max_tokens=int(config.get("maxTokens").data),
                )
                responseMsg = response.choices[0].message.content
                app.logger.debug("Non-cached response - caching '%s'...",
                                 user_input)
                # Cache response for future use            
                addResponse(user_input,responseMsg) 
            return responseMsg
        except Exception as err:
            # Error handlers
            app.logger.error("Exception fired %s", traceback.format_exc())
            if hasattr(err, "message"):
                return err.message
            else:
                return err

#
# Standard routines for handling URIs
#

# Base GET URI loader
@app.route("/")
def index():
    return render_template("index.html")

# Version GET handler
@app.route("/version")
def version() -> Any:
    return jsonify({"version":"1.0"})

# Status GET probe handler
@app.route("/status")
def status() -> Any:
    return jsonify({"status":"live"})

# Chat POST handler
@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json["message"]
    response = get_chat_response(user_input)
    return jsonify({"response": response})

#
# Main routine
#
if __name__ == "__main__":
    signal.signal(signal.SIGBUS, handler)
    signal.signal(signal.SIGABRT, handler)
    signal.signal(signal.SIGILL, handler)
    signal.signal(signal.SIGTERM, handler)

    if load_properties("resources/app.properties"):
        # port = int(os.environ.get("PORT", 5000))
        port = int(config.get("port").data)
        isDebug = bool(config.get("debug").data == "true")
        if isDebug:
            logging.basicConfig(level=logging.DEBUG)
        app.logger.debug("Listening on port %d", port)
        app.run(debug=isDebug, host="0.0.0.0", port=port)
        sys.exit(0)
    else:
        sys.exit(1)
