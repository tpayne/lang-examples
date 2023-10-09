Web Server Sample
==================

This repo contains a simple example Node.JS Webserver that runs a relay service.

Running the Example with Basic Ops
----------------------------------
This example creates and runs a simple Node.JS web server.

To run this solution please do the following steps. They will build and run the sample locally. You do not need a Node.JS environment installed.

    docker build . --tag nodejs:1.0 && docker run --rm -p 5555:8080 nodejs:1.0

If everything has worked as expected, then you can run services like the following...

    curl localhost:5555/
    curl localhost:5555/cmd
    curl localhost:5555/version
    
The following demos a http relay server (re-directing to another HTTPS Web API)...

    curl localhost:5555/repostring
    curl localhost:5555/api/repo
    
Cleaning Up
-----------
To clean up the installation, do the following...

    docker rmi nodejs:1.0
        
This will delete all the items created in your session.

Notes
-----
This code does not have any unit testing or SA analysis run as part of the process

References
----------
- https://docs.npmjs.com
- https://www.w3schools.io/file/properties-read-write-javascript/
- https://nodejs.org/en/docs/



