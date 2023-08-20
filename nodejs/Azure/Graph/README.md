Graph Application
=================

This repo contains a simple example NodeJS REST API app that works with Azure Graph KQL using managed identifies.

To run this sample, you will need to have access to an Azure CSP and an
AKS instance that you can deploy too.

What does this sample do?
-------------------------
This example consists of the following...
* A NodeJS REST API application coded to authenticate against a managed identify and run KQL queries based on it

To use this sample, you need to do the following...
* Have the ability to deploy K8s objects into an AKS namespace
* Be able to run a Helm Chart to deploy the application

Running the Helm chart provided in this sample will...
* Deploy the application
* Provide a set of sample REST APIs that allow you to run various queries againt KQL
* Provide a simple Web interface to using the APIs

Building the Application
------------------------
The repo has a Dockerfile which is responsible for building the application and creating a containerised image.

The Dockerfile uses publically available official NodeJS Alpine images and then installs various components from Alpine distribution repos into those images.

When these images are run they use specific users and do NOT have elevated root privileges.

To build and run the image locally, you can do the following...

```shell
docker build -t nodejskqlsample .
```

Deploying the Application
-------------------------
To deploy the application, please review the following instructions.

### Deploying the App as an ACI
To deploy the app as an ACI, please do the following...

Create a managed identity using the below commands and deploy an
ACI using a pre-build image.

```shell
az identity delete -g testapp -n testapp
az container delete -g testapp \
    --name testapp -y
az identity create -g testapp -n testapp
az container create -g testapp \
    --name testapp --image \
    ghcr.io/tpayne/nodejsazurequery:master \
    --ports 3000 --ip-address public
az container show -g testapp \
    --name testapp | grep '"ip"'
```

You can then either...
* assign the user managed identity created above to the ACI and
give it `Reader` role
* or use a system-assigned managed identity and also give it `Reader` role

### Using AKS & Helm
Before running the `helm install` or `helm template` commands, please review
the `values.yaml` file to ensure the values are as you expect. You will most
likely have to edit them to conform to your environment. This will include the
managed identity variables etc.

Either of the following commands will install the Helm chart against your AKS system.

```shell
helm template graphql-sample \
    -f values.yaml \
    k8s-service \
    --repo https://helmcharts.gruntwork.io/ |\
kubectl apply -f - -n <ns>
```

```shell
helm install graphql-sample \
    -f values.yaml \
    k8s-service \
    -n <ns> \
    --repo https://helmcharts.gruntwork.io/
```

It is suggested you `--dry-run` the process first to ensure no syntax errors are present.

To configure the app for running you will need to ...

Running the App
---------------
The app is designed to provide a number of simple Web services that allow you to interact with the Azure Graph SDK. You can use them to run various KQL queries.

The following are some usage examples of the application running. To use them on your system, you will need to modify `localhost:3000` to the appropriate Ingress that you are using for AKS or your ACI.

```shell
curl localhost:3000/api/query/healthz
{"message":"Ok"}
curl localhost:3000/api/query/count
[
  {
    "type": "microsoft.managedidentity/userassignedidentities",
    "count_": 1
  },
  {
    "type": "microsoft.containerinstance/containergroups",
    "count_": 1
  }
]
curl localhost:3000/api/query/list
[
  {
    "name": "testapp",
    "type": "microsoft.managedidentity/userassignedidentities",
    "location": "westeurope"
  },
  {
    "name": "testapp",
    "type": "microsoft.containerinstance/containergroups",
    "location": "westeurope"
  }
]
```

If running this application outside of AKS, then you will need to ensure the `config/apps.property` file exists in the Docker image in `/config`. You can do this by modifying the `Dockerfile` as appropriate.

Cleaning Up
-----------
To clean up the installation, uninstall the Helm chart or delete the ACI and MI using:-

```shell
az identity delete -g testapp -n testapp
az container delete -g testapp \
    --name testapp -y
```

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
