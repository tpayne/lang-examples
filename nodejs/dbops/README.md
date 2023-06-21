CosmosDB PG Application
=======================

This repo contains a simple example Node.JS REST API that works with Azure CosmosDB Postgres.

To run this sample, you will need to have access to a CosmosDB Postgres installation, AKS and the necessary passwords to do a database deployment.

What does this sample do?
-------------------------
This example consists of the following...
* A database schema definition and sample data
* A NodeJS REST API application coded to work against that sample
* A Helm chart to deploy the database and then the sample app

To use this sample, you need to do the following...
* Spin up a CosmosDB Postgres installation you can access with the Citus account - you also need the database password (if set)
* Spin up an AKS with an Ingress controller deployed. By default, the AKS HTTPS one is used, but if you are using a different one like AGIC or NGINX, then you will need to change the Ingress definition appropriately
* The ability to deploy Service accounts etc. to an AKS namespace

Running the Helm chart provided in the sample will...
* Create the database and sample data in Postgres
* Distribute the data definitions to worker nodes
* Deploy the application and check the database is accessible. If this fails, then the application will fail to start
* Create an Ingress entry point from which the application can be accessed

The sample itself provides some REST APIs that allows you to interact with the tables and views created to get data back in JSON format.

Building the Application
------------------------
The repo has a Dockerfile which is responsible for building the application and creating a containerised image.

The Dockerfile uses publically available official NodeJS Alpine images and then installs various components from Alpine distribution repos into those images. When run, these images use specific users and do NOT have elevated root privileges.

To build and run the image locally, you can do the following...

```shell
    (cd app && docker build . -t nodejsdb:1.0 && docker run --rm -t -p 3000:3000 nodejsdb:1.0)
    curl localhost:3000/info
```

Helm Charts
-----------
As detailed elsewhere in this README, the application is deployed using a customised Helm chart. This chart has the following structure.

```console
    dbpgapp-helm
    ├── Chart.yaml
    ├── files
    │   └── db
    │       ├── shell
    │       │   └── dbdeploy.cmd
    │       └── sqlscripts
    │           ├── create
    │           │   ├── create-database.sql
    │           │   ├── create-schema.sql
    │           │   └── insert-app-schema.sql
    │           └── drop
    │               ├── drop-database.sql
    │               └── drop-schema.sql
    ├── templates
    │   ├── NOTES.txt
    │   ├── _helpers.tpl
    │   ├── app
    │   │   ├── deployment.yaml
    │   │   ├── hpa.yaml
    │   │   ├── ingress.yaml
    │   │   ├── service.yaml
    │   │   └── serviceaccount.yaml
    │   └── db
    │       ├── configmaps
    │       │   ├── configmap-createdata.yaml
    │       │   ├── configmap-createdb.yaml
    │       │   ├── configmap-createschema.yaml
    │       │   ├── configmap-db.yaml
    │       │   ├── configmap-dropdb.yaml
    │       │   └── configmap-dropschema.yaml
    │       ├── pod.yaml
    │       └── secrets.yaml
    └── values.yaml

    11 directories, 23 files
```

The `files` directory has files which are dynamically loaded and used during the deployment, e.g. SQL scripts etc.

The `db` directory has the files associated with the Postgres deployment.

The `app` directory has the files associated with the application deployment

Deploying the Application
-------------------------
To deploy the application, please do the following...

You can use various Helm approaches like `install` or `template`. The approach shown below is using `template` as it allows you to view the YAML created to see what it looks like and tweak as appropriate. For real deployments, you should use `install`

```shell
    helm template . \
        --set-string \
            DbDeploy.secrets.password="<CitusDBPassword>",\
            DbDeploy.config.host="<CosmosDBServer>" \
            | kubectl apply -f -
```

This will...
* Deploy various configmaps with schema definitions. These SQL definitions are loaded dynamically from `dbpgapp-helm/files/db/sqlscripts` and are used to drive the database creation
* Deploy a Postgres client image singleton POD to run the scripts using a script from `dbpgapp-helm/files/db/shell/dbdeploy.cmd`. You can modify this script if you want to ensure more logging, error handling etc.
* Deploy a NodeJS application image built using the Dockerfile `app`. You will need to update the Helm chart to pickup different images as required, e.g. if you are using a different CR repo
* Create an Ingress to act as a public endpoint for the app

Running the App
---------------
The app has various endpoints you can use to interact with the CosmosDB database. These are shown below.

Some of the samples will query from tables or views and some of them are used for health checks or info queries.

```shell
    curl restapi.ukwest.cloudapp.azure.com/dbapi/healthz
    {"message":"Service Ok"}
    curl restapi.ukwest.cloudapp.azure.com/dbapi/info
    {"info":"This is a Demoapp for Postgres"}
    curl restapi.ukwest.cloudapp.azure.com/dbapi/version
    {"version":"1.0.0"}

    curl restapi.ukwest.cloudapp.azure.com/dbapi/orders
    [{"customer_name":"ACME","order_name":"ORD001","stock_item":"GPU/001/MTU","order_date":"2023-06-19T10:27:41.851Z","number_ordered":10},{"customer_name":"ACME","order_name":"ORD001","stock_item":"TERM/001/MTU","order_date":"2023-06-19T10:27:41.851Z","number_ordered":10},{"customer_name":"ACME","order_name":"ORD002","stock_item":"GPU/001/MTU","order_date":"2023-06-19T10:27:41.851Z","number_ordered":10},{"customer_name":"ACME","order_name":"ORD002","stock_item":"TERM/001/MTU","order_date":"2023-06-19T10:27:41.851Z","number_ordered":10},{"customer_name":"ACME","order_name":"ORD003","stock_item":"GPU/001/MTU","order_date":"2023-06-19T10:27:41.851Z","number_ordered":10},{"customer_name":"ACME","order_name":"ORD003","stock_item":"TERM/001/MTU","order_date":"2023-06-19T10:27:41.851Z","number_ordered":10}]

    curl restapi.ukwest.cloudapp.azure.com/dbapi/customers
    [{"customer_uid":1,"name":"TSB","create_date":"2023-06-19T10:27:41.833Z","update_date":"2023-06-19T10:27:41.833Z","description":"TSB Customer"},{"customer_uid":2,"name":"LBG","create_date":"2023-06-19T10:27:41.833Z","update_date":"2023-06-19T10:27:41.833Z","description":"LBG Customer"},{"customer_uid":3,"name":"ACME","create_date":"2023-06-19T10:27:41.833Z","update_date":"2023-06-19T10:27:41.833Z","description":"ACME Customer"}]

    curl restapi.ukwest.cloudapp.azure.com/dbapi/stock
    [{"stock_uid":4,"name":"GPU/001/MTU","create_date":"2023-06-19T10:27:41.842Z","update_date":"2023-06-19T10:27:41.842Z","no_stock":2000,"description":"MTU Series GPU"},{"stock_uid":5,"name":"CPU/001/MTU","create_date":"2023-06-19T10:27:41.842Z","update_date":"2023-06-19T10:27:41.842Z","no_stock":2000,"description":"MTU Series CPU"},{"stock_uid":6,"name":"TERM/001/MTU","create_date":"2023-06-19T10:27:41.842Z","update_date":"2023-06-19T10:27:41.842Z","no_stock":2000,"description":"MTU Series Terminal"}]
```

Cleaning Up
-----------
To clean up the installation, uninstall the Helm chart. Note, this will not remove the schema, but scripts are provided to help you do this if needed.

Notes
-----
- This code does not have any unit testing or SA analysis run as part of the CI process
- If you need to implement different authentication mechanisms for accessing CosmosDB, then please see https://node-postgres.com/features/connecting

References
----------
- https://docs.npmjs.com
- https://www.w3schools.io/file/properties-read-write-javascript/
- https://nodejs.org/en/docs/
- https://github.com/brianc/node-postgres/tree/master/docs
