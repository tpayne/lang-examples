Web RESTAPI Sample
==================

This repo contains an example C# RESTful API.

Running the Example with Basic Ops
----------------------------------
This example creates and runs a C# web server.

If you are using the Apple M1 chipset, please review the comments in the Dockerfiles and use this Dockerfile instead `Dockerfile.vcnet7.arm64v8`.

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

Running the GitHub REST API Examples 
------------------------------------
The following will demo how to interface with the GitHub API in various ways. These examples are
not comprehensive, but cover many of the GitHub Action API endpoints.

For these demos to work you will need a repo with GitHub Actions setup and a PAT token to write
and read to them.

In the following examples...
* `GHPAT_TOKEN` - Is your GH PAT token to access your repo
* `owner` - Is your repo owner
* `repo` - Is your repo name
* `workflowUid` - Is your workflow that you want to launch - i.e. a GitHub Action used by your repo
* `jobUid` - Is a job that has been launched on a specific workflow

### Launching Jobs
The following will launch a job using a specific workflow in your repo. For this command to work properly
you must set up your GH Actions to have `inputs` in a similar fashion to those used in Actions in this repo.
The input id you need to copy is called `id`.

Please see the following sample: -

```yaml
  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:
    inputs:
      id:
        description: 'run identifier'
        required: false
        default: 'Job001'
        type: string

  # Tasks and jobs to run 
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
      - name: ${{github.event.inputs.id}}
        run: echo Running job ${{github.event.inputs.id}}   
```

This example will execute a workflow and give you the `runUid` (aka `jobUid`) of that workflow execution back.

```console
  curl \
      -X POST      \
      -H "Authorization: Bearer <GHPAT_TOKEN>"     \
      -H "Content-Type: application/json" \
      http://localhost:5555/api/monitor/<owner>/<repo>/workflow/<workflowUid>/execute
```

This example will execute a workflow and pass parameters into it. It does not return a `runUid` back.

```console
  curl \
      -X POST  \
      -H "Authorization: Bearer <GHPAT_TOKEN>" \
      -H "Content-Type: application/json" \
      http://localhost:5555/api/actions/<owner>/<repo>/<workflowUid>/execute \
      -d '{"ref":"master","inputs":{"id":"TestRun"}}'
```

### Listing Job Status and Steps
These examples will get data from jobs which have either run and are running

The following will return all the data about a job and the steps it is/has executed.

```console
  curl  \
      -X GET \
      -H "Authorization: Bearer <GHPAT_TOKEN>"    \
      http://localhost:5555/api/monitor/<owner>/<repo>/job/<jobUid>/steps
```

```console
  curl \
      -X GET \
      -H "Authorization: Bearer <GHPAT_TOKEN>" \
      http://localhost:5555/api/actions/<owner>/<repo>/jobs/<jobUid>
```

The following will return all the output logs from a job and the steps it is/has executed.

In this sample, you can usually just set `runNo` to `1`.

```console
  curl  \
      -X GET \
      -H "Authorization: Bearer <GHPAT_TOKEN>"    \
      http://localhost:5555/api/monitor/<owner>/<repo>/job/<jobUid>/logs/<runNo>
```

The following will return details of all the executions of a workflow that have
happened since a certain date. The date used must comply to ISO date time format, e.g.
`2023-01-20T19:00`

```console
  curl \
      -X GET \
      -H "Authorization: Bearer <GHPAT_TOKEN>" \
      http://localhost:5555/api/actions/<owner>/<repo>/jobs/list?runDate=<isoDate>
```

### Listing Workflow Information
These examples will get data about workflows (Actions) registered in a repo.

The following will return details of all the workflows registered in a repo. You can use
this query to get the `<workflowUid>` for GitHub Actions.

```console
  curl \
      -X GET \
      -H "Authorization: Bearer <GHPAT_TOKEN>" \
      localhost:5555/api/actions/<owner>/<repo>/list
```

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


