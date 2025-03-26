Python GPT Chatbot Sample
==================

This repo contains a simple example chatbot that runs using the ChatGPT API.

Running the Example with Basic Ops
----------------------------------
This example creates and runs a chatbot web server.

To run this solution please do the following steps. They will build and run the sample locally. You do not need a Python environment installed.

    docker build . --tag chatbot:1.0 && \
     docker run --rm -p 8080:5000 \
        -e OPENAI_API_KEY=<YourKey> \
        chatbot:1.0 

If everything has worked as expected, then you can open the chatbot on port localhost:8080.
    
You have various contexts available that the bot supports. These can be accessed using...

```bash
bot-context load tvr-cars.txt
bot-context load marcos-cars.txt
```

If you use the `tvr-cars.txt`, then you can ask questions about TVRs. Similar to the Marcos sample.

Cleaning Up
-----------
To clean up the installation, do the following...

    docker rmi chatbot:1.0
        
This will delete all the items created in your session.

Notes
-----
This code does not have any unit testing or SA analysis run as part of the process

References
----------
- None



