Storage Application
===================

This repo contains a simple example NodeJS REST API app that works with Azure Storage
Account(s) using Files.

To run this sample, you will need to have access to an Azure Storage Account and an
AKS instance that you can deploy too.

What does this sample do?
-------------------------
This example consists of the following...
* A NodeJS REST API application coded to authenticate against an Azure Storage account and manipulate file shares in it

To use this sample, you need to do the following...
* Spin up an Azure Storage Account
* Have the ability to deploy K8s objects into an AKS namespace
* Be able to run a Helm Chart to deploy the application

Running the Helm chart provided in this sample will...
* Deploy the application
* Provide a set of sample REST APIs that allow you to create, delete and list file shares
* Provide a simple Web interface to using the APIs

Building the Application
------------------------
The repo has a Dockerfile which is responsible for building the application and creating a containerised image.

The Dockerfile uses publically available official NodeJS Alpine images and then installs various components from Alpine distribution repos into those images.

When these images are run they use specific users and do NOT have elevated root privileges.

To build and run the image locally, you can do the following...

```shell
    docker build -t nodejs-serverless-storage-filesample .
```

Deploying the Application
-------------------------
To deploy the application, please review the following instructions.

Before running the `helm install` or `helm template` commands, please review
the `values.yaml` file to ensure the values are as you expect. You will most
likely have to edit them to conform to your environment.

Either of the following commands will install the Helm chart against your AKS system.

```console
    helm template storage-files \
        -f values.yaml \
        k8s-service \
        --repo https://helmcharts.gruntwork.io/ |\
    kubectl apply -f - -n <ns>
```

```console
    helm install storage-files \
        -f values.yaml \
        k8s-service \
        -n <ns> \
        --repo https://helmcharts.gruntwork.io/
```

It is suggested you `--dry-run` the process first to ensure no syntax errors are present.

Running the App
---------------
The app is designed to provide a number of simple Web services that allow you to interact with the Azure File SDK. You can use them to create, delete or list tables in a Storage
Account.

To run the app, you need to configure the storage account that the app uses or ensure that it is exposed into the environment.

To configure this you can either edit the properties file - `config/app.properties` or `export STORAGE_ACCOUNT=<accountName>` into the environment used by the container. If deploying this app to AKS, then you will need to edit the `ConfigMap` definition in
`values.yaml`.

It is also recommended that you use the `storage-account-key` property in the
`config/apps.property` file to allow anyone to run the APIs. This value can be set by editting the `ConfigMap` definition detailed above.

The following are some usage examples of the application running. To use them on your system, you will need to modify `localhost:3000` to the appropriate Ingress that you are using for AKS.

This following examples shown how the REST API works for shares.

```shell
    curl "localhost:3000/api/shares/healthz"
    {"message":"Ok"}
    curl -X POST "localhost:3000/api/shares/create" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall"
    {"message":"Share created"}
    curl "localhost:3000/api/shares/list"
    [{"name":"testall","accessTierChangeTime":"2023-08-07T20:13:51.000Z","lastModified":"2023-08-07T20:13:51.000Z","quota":5120,"accessTier":"TransactionOptimized","leaseStatus":"unlocked"}]
    curl -X POST "localhost:3000/api/shares/drop" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall"
    {"message":"Share dropped"}
```

This following examples shown how the REST API works for files.

```shell
    curl -X POST "localhost:3000/api/files/create" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=test.txt"
    {"message":"File created"}
    curl -X POST "localhost:3000/api/files/create" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=a/b/c/d/test.txt"
    {"message":"File created"}
    curl -X POST "localhost:3000/api/files/create" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=a/b/c/d/e/"
    {"message":"File created"}
    curl "localhost:3000/api/files/list?share=testall"
    [{"name":"test.txt","kind":"file","fileId":"13835128424026341376","parent":"/","fullPath":"test.txt"},{"name":"a","kind":"directory","fileId":"11529285414812647424","parent":"/","fullPath":"a"},{"name":"b","kind":"directory","fileId":"16140971433240035328","parent":"a/","fullPath":"a/b"},{"name":"c","kind":"directory","fileId":"10376363910205800448","parent":"a/b/","fullPath":"a/b/c"},{"name":"d","kind":"directory","fileId":"14988049928633188352","parent":"a/b/c/","fullPath":"a/b/c/d"},{"name":"test.txt","kind":"file","fileId":"12682206919419494400","parent":"a/b/c/d/","fullPath":"a/b/c/d/test.txt"},{"name":"e","kind":"directory","fileId":"16717432185543458816","parent":"a/b/c/d/","fullPath":"a/b/c/d/e"}]
    curl -X POST "localhost:3000/api/files/drop" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=test.txt"
    {"message":"File dropped"}
    curl -X POST "localhost:3000/api/files/drop" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=a/b/c/d/test.txt"
    {"message":"File dropped"}
    curl -X POST "localhost:3000/api/files/drop" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=a/b/c/d/e/"
    {"message":"File dropped"}
    curl -X POST "localhost:3000/api/files/drop" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "share=testall" \
        -d "file=a/b/c/d/"
    {"message":"File dropped"}
    curl "localhost:3000/api/files/list?share=testall"
    [{"name":"a","kind":"directory","fileId":"11529285414812647424","parent":"/","fullPath":"a"},{"name":"b","kind":"directory","fileId":"16140971433240035328","parent":"a/","fullPath":"a/b"},{"name":"c","kind":"directory","fileId":"10376363910205800448","parent":"a/b/","fullPath":"a/b/c"}]
```

Cleaning Up
-----------
To clean up the installation, uninstall the Helm chart.

Notes
-----
- This code does not have any unit testing or SA analysis run as part of the CI process

Known Issues List
-----------------
The following are known issues

- The Web interface does not currently support redirection on the Ingress Path. If you wish to do this, then the Create and Delete table functions will not work. All other functionality is however supported. The REST APIs will work fine.
- The Web interface is very crude and only supports essential functionality for testing purposes

References
----------
- https://docs.npmjs.com
- https://www.w3schools.io/file/properties-read-write-javascript/
- https://nodejs.org/en/docs/
- https://gruntwork.io/repos/v0.1.1/helm-kubernetes-services/charts/k8s-service/README.md
