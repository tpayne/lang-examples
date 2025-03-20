from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# In a real application, you'd replace this with a more sophisticated chat model.
def get_chat_response(user_input):
    """Simple placeholder for a chat model."""
    if "hello" in user_input.lower():
        return "Hello there! How can I help you?"
    elif "how are you" in user_input.lower():
        return "I'm doing well, thank you!"
    else:
        return "I'm not sure how to respond to that."

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json["message"]
    response = get_chat_response(user_input)
    return jsonify({"response": response})

if __name__ == "__main__":
    app.run(debug=True)

