Web RESTAPI Sample
==================

This repo contains an example C# RESTful API.

Running the Example
-------------------
This example creates and runs a C# web server.

To run this solution please do the following steps.

    docker build . --tag csharpwsapi:1.0
    docker run --rm -p 5555:80 csharpwsapi:1.0

If everything has worked as expected, then you can run services like the followingg...

    curl localhost:5555/api/test/version
    curl -k -X POST -H "Content-Type: application/json" \
      -d '{"machineType": "linux","inetInterface": "test","zoneId": "us-central-a1","instanceName": "testme1","imageName": "testj"}' "localhost:5555/api/test/compute"

    curl -k -X POST -H "Content-Type: application/json" \
      -d '{"machineType": "linux","inetInterface": "test","zoneId": "us-central-a1","instanceName": "testme2","imageName": "testj"}' "localhost:5555/api/test/compute"

    curl -k -X POST -H "Content-Type: application/json" \
      -d '{"machineType": "linux","inetInterface": "test","zoneId": "us-central-a1","instanceName": "testme3","imageName": "testj"}' "localhost:5555/api/test/compute"

    curl -k -X POST -H "Content-Type: application/json" \
      -d '{"machineType": "linux","inetInterface": "test","zoneId": "us-central-a1","instanceName": "testme4","imageName": "testj"}' "localhost:5555/api/test/compute"

    curl -k -X POST -H "Content-Type: application/json" \
      -d '{"machineType": "linux","inetInterface": "test","zoneId": "us-central-a1","instanceName": "testme5","imageName": "testj"}' "localhost:5555/api/test/compute"    

    curl localhost:5555/api/test/compute

Cleaning Up
-----------
To clean up the installation, do the following...

    docker rmi csharpwsapi:1.0
        
This will delete all the items created in your session.

References
----------
TBD
