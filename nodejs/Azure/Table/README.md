Storage Application
===================

This repo contains a simple example NodeJS REST API app that works with Azure Storage
Account(s) using Tables.

To run this sample, you will need to have access to an Azure Storage Account and an
AKS instance that you can deploy too.

What does this sample do?
-------------------------
This example consists of the following...
* A NodeJS REST API application coded to authenticate against an Azure Storage account and manipulate data tables in it

To use this sample, you need to do the following...
* Spin up an Azure Storage Account
* Have the ability to deploy K8s objects into an AKS namespace
* Be able to run a Helm Chart to deploy the application

Running the Helm chart provided in this sample will...
* Deploy the application
* Provide a set of sample REST APIs that allow you to create, delete and list tables
* Provide a simple Web interface to using the APIs

Building the Application
------------------------
The repo has a Dockerfile which is responsible for building the application and creating a containerised image.

The Dockerfile uses publically available official NodeJS Alpine images and then installs various components from Alpine distribution repos into those images.

When these images are run they use specific users and do NOT have elevated root privileges.

To build and run the image locally, you can do the following...

```shell
    docker build -t nodejs-serverless-storage-tablesample .
```

Deploying the Application
-------------------------
To deploy the application, please review the following instructions.

Before running the `helm install` or `helm template` commands, please review
the `values.yaml` file to ensure the values are as you expect. You will most
likely have to edit them to conform to your environment.

Either of the following commands will install the Helm chart against your AKS system.

```console
    helm template storage-table \
        -f values.yaml \
        k8s-service \
        --repo https://helmcharts.gruntwork.io/ |\
    kubectl apply -f - -n <ns>
```

```console
    helm install storage-table \
        -f values.yaml \
        k8s-service \
        -n <ns> \
        --repo https://helmcharts.gruntwork.io/
```

It is suggested you `--dry-run` the process first to ensure no syntax errors are present.

Running the App
---------------
The app is designed to provide a number of simple Web services that allow you to interact with the Azure Table SDK. You can use them to create, delete or list tables in a Storage
Account.

To run the app, you need to configure the storage account that the app uses or ensure that it is exposed into the environment.

To configure this you can either edit the properties file - `config/app.properties` or `export STORAGE_ACCOUNT=<accountName>` into the environment used by the container. If deploying this app to AKS, then you will need to edit the `ConfigMap` definition in
`values.yaml`.

It is also recommended that you use the `storage-account-key` property in the
`config/apps.property` file to allow anyone to run the APIs. This value can be set by editting the `ConfigMap` definition detailed above.

The following are some usage examples of the application running. To use them on your system, you will need to modify `localhost:3000` to the appropriate Ingress that you are using for AKS.

```shell
    curl "localhost:3000/api/tables/healthz"
    {"message":"Ok"}
    curl -X POST "localhost:3000/api/tables/create" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "table=testall"
    {"message":"Table created"}
    curl "localhost:3000/api/tables/list"
    [{"name":"test"},{"name":"testall"},{"name":"test123"}]
    curl -X POST "localhost:3000/api/tables/drop" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "table=testall"
    {"message":"Table dropped"}
```

If running this application outside of AKS, then you will need to ensure the `config/apps.property` file exists in the Docker image in `/config`. You can do this by modifying the
`Dockerfile` as appropriate.

Cleaning Up
-----------
To clean up the installation, uninstall the Helm chart.

Notes
-----
- This code does not have any unit testing or SA analysis run as part of the CI process
- The web interface is currently very crude and only provides the essentials for testing

Known Issues List
-----------------
The following are known issues

- The Web interface does not currently support redirection on the Ingress Path. If you wish to do this, then the Create and Delete table functions will not work. All other functionality is however supported. The REST APIs will work fine.

References
----------
- https://docs.npmjs.com
- https://www.w3schools.io/file/properties-read-write-javascript/
- https://nodejs.org/en/docs/
- https://gruntwork.io/repos/v0.1.1/helm-kubernetes-services/charts/k8s-service/README.md
