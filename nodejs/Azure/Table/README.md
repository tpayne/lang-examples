Storage Application
=======================

This repo contains a simple example Node.JS REST API that works with Azure Storage Storage Account(s) (Blob).

To run this sample, you will need to have access to a Azure Storage Storage Account(s) (Blob) and an AKS instance to which you can deploy too.

What does this sample do?
-------------------------
This example consists of the following...
* A NodeJS REST API application coded to authenticate to an Azure Storage Storage Account (Blob) instance, and create a container upon it.

To use this sample, you need to do the following...
* Spin up an Azure Storage Account
* The ability to deploy Service accounts etc. to an AKS namespace
* A Helm Chart used to deploy the application, to AKS as a Container

Running the Helm chart provided in the sample will...
* Deploy the application and check the storage account is accessible. If this fails, then the application will fail to start
* Create a sample container atop the Azure Storage Account, and list out Containers within the Storage Account

Building the Application
------------------------
The repo has a Dockerfile which is responsible for building the application and creating a containerised image.

The Dockerfile uses publically available official NodeJS Alpine images and then installs various components from Alpine distribution repos into those images. When run, these images use specific users and do NOT have elevated root privileges.

To build and run the image locally, you can do the following...

```shell
docker build -t nodejs-serverless-storage-sample .
```

Helm Charts
-----------
As detailed elsewhere in this README, the application is deployed using a customised Helm chart.

The Chart used here, is the Serverless Generic Helm Chart which can be found below:

https://github.com/lbg-cloud-platform/lcp-cips-vdc-generic-helm-chart-serverless

This chart has the following structure:

```shell
├── Chart.yaml
├── linter_values.yaml
├── templates
│   ├── NOTES.txt
│   ├── _capabilities_helpers.tpl
│   ├── _deployment_spec.tpl
│   ├── _helpers.tpl
│   ├── canarydeployment.yaml
│   ├── customresources.yaml
│   ├── deployment.yaml
│   ├── horizontalpodautoscaler.yaml
│   ├── ingress.yaml
│   ├── pdb.yaml
│   ├── service.yaml
│   └── serviceaccount.yaml
└── values.yaml
```

Deploying the Application
-------------------------
To deploy the application, please do the following...

You can use various Helm approaches like `install` or `template`. The approach shown below is using `template` as it allows you to view the YAML created to see what it looks like and tweak as appropriate. For real deployments, you should use `install`

A sample values.yaml file for the below helm commands, can be found in this directory.

```shell
helm template [APP_NAME_HERE] [PATH_TO_CHART_HERE] --values [PATH_TO_VALUES_FILE_HERE]
```

Using Helm `install`, you can do the install using a command like...

```shell
helm install [APP_NAME_HERE] [PATH_TO_CHART_HERE] --namespace [TARGET_NAMESPACE_HERE] --values [PATH_TO_VALUES_FILE_HERE]
```

Although you might want to `--dry-run` the installation first.

This install process will...
* Deploy a NodeJS application image built using the Dockerfile `app`. You will need to update the Helm chart to pickup different images as required, e.g. if you are using a different CR repo

Running the App
---------------
The app is simply designed to automate the creation of the Container(s), and will output the success or failure to the console, which can be validated by access the container logs which can be achieved via the below command:

```shell
kubectl logs -c [CONTAINER_NAME] -p [POD_NAME]
```

Cleaning Up
-----------
To clean up the installation, uninstall the Helm chart.

Notes
-----
- This code does not have any unit testing or SA analysis run as part of the CI process

References
----------
- https://docs.npmjs.com
- https://www.w3schools.io/file/properties-read-write-javascript/
- https://nodejs.org/en/docs/
