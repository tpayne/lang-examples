CLI Parser Sample
=================

This repo contains a simple example Node.JS Parser for CLI

Running the Example with Basic Ops
----------------------------------
This example creates and runs a simple Node.JS CLI parser.

To run this solution please do the following steps. They will build and run the sample locally. You do not need a Node.JS environment installed.

    docker build . --tag nodejs:1.0 && docker run --rm -it nodejs:1.0
    
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
- https://nodejs.org/en/docs/



