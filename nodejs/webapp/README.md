Web Server Sample
==================

This repo contains a simple example Webserver.

Running the Example with Basic Ops
----------------------------------
This example creates and runs a simple web server.

To run this solution please do the following steps. They will build and run the sample locally. You do not need a .NET environment installed.

    docker build . --tag nodejs:1.0 && docker run --rm -p 5555:8080 nodejs:1.0

If everything has worked as expected, then you can run services like the following...

    curl localhost:5555/
    curl localhost:5555/cmd
    curl localhost:5555/version
    
Cleaning Up
-----------
To clean up the installation, do the following...

    docker rmi nodejs:1.0
        
This will delete all the items created in your session.

Notes
-----
NA

References
----------
NA


