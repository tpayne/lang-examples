Web RESTAPI Sample
==================

This repo contains an example C# RESTful API.

Running the Example with Basic Ops
----------------------------------
This example creates and runs a C# web server.

If you are using the Apple M1 chipset, please review the comments in the Dockerfiles.

To run this solution please do the following steps. They will build and run the sample locally. You do not need a .NET environment installed.

    docker build . --tag csharpwsapi:1.0 && docker run --rm -p 5555:80 csharpwsapi:1.0

If everything has worked as expected, then you can run services like the following...

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
    curl "localhost:5555/api/test/list?projectId=proj1&zone=zone1"
    curl "localhost:5555/api/test/list?projectId=proj2&zone=zone2"
    curl "localhost:5555/api/test/list?projectId=proj3&zone=zone3"
    curl "localhost:5555/api/test/list?projectId=proj4&zone=zone4"
    curl "localhost:5555/api/test/list"

Running the Example with Advanced Ops
-------------------------------------
The following will demo a http relay and JSON processing. The sample will interact with the
GitHub API using HTTP API and JSON format the result.

This command will use a HTTP client command to interact with another web service...

    curl localhost:5555/api/repo/list
    
This command will create a custom object to represent information and dump it in JSON format for use by another WS if needed...

    curl localhost:5555/api/repo/dump
    
This command will create a JSON prettified string and dump it...
    
    curl localhost:5555/api/repo/repostring

Cleaning Up
-----------
To clean up the installation, do the following...

    docker rmi csharpwsapi:1.0
        
This will delete all the items created in your session.

Issues
------
- The monitor functionality currently only returns when the job has finished - this needs debugging as it is probably related to the GitHub API not returning until a job has finished

Notes
-----
- The JSON parser that c# uses is extremely paranoid about obeying the JSON format rules and will often error for no good reason. To fix just try playing with the format string a bit
- You can ignore the `-k` param on curl. This was just used during testing the `dotnet run` version

References
----------
- https://docs.microsoft.com/en-us/dotnet/core/get-started
- https://github.com/dotnet/dotnet-docker
- https://docs.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentstack-1?view=net-6.0
- https://docs.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentdictionary-2?view=net-6.0
- https://docs.microsoft.com/en-us/aspnet/core/fundamentals/middleware/write?view=aspnetcore-6.0
- https://docs.microsoft.com/en-us/aspnet/core/tutorials/first-web-api?view=aspnetcore-5.0&tabs=visual-studio-mac#examine-the-get-methods
- https://docs.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.httppostattribute?view=aspnetcore-6.0
- https://docs.microsoft.com/en-us/aspnet/core/mvc/controllers/routing?view=aspnetcore-5.0#verb
- https://github.com/microsoft
- https://github.com/azure/azure-sdk
- https://github.com/Azure/azure-sdk-for-net
- https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onworkflow_dispatchinputs
- https://hub.docker.com/_/microsoft-dotnet-aspnet/
- https://hub.docker.com/_/microsoft-dotnet-sdk
- https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#get-a-workflow-run


