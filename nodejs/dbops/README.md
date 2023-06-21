CosmosDb PG Sample
==================

This repo contains a simple example Node.JS REST API which works with CosmosDB Postgres.

To run this sample, you will need to have access to a CosmosDB Postgres installation, AKS and the necessary passwords to do a database deployment.

What does this sample do?
-------------------------
This example consists of the following...
* A database schema definition and sample data
* A NodeJS REST API application coded to work against that sample
* A Helm chart to deploy the database and then the sample app

To use this sample, you need to do the following...
* Spin up a CosmosDB Postgres installation you can access with the Citus account - you also need the database password (if set)
* Spin up an AKS with an Ingress controller deployed. By default, the AKS HTTPs one is used, but if using a different one like AGIC or NGINX, then you will need to change the Ingress definition appropriately
* Ability to deploy Service accounts etc. to an AKS namespace

Running the Helm chart provided in the sample will...
* Create the database and sample data in Postgres
* Distribute the data definitions to worker nodes
* Deploy the application and check the database is accessible. If this fails, then the application will fail to start
* Create an Ingress entry point from which the application can be accessed

The sample itself provides some REST APIs that allows you interact with the tables and views created to get data back in JSON format. 

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
* Deploy various configmaps with the schema definitions. The SQL scripts are loaded dynamically from `lang-examples/nodejs/dbops/dbpgapp-helm/files/db/sqlscripts`
* Deploy a Postgres client image singleton POD to run the scripts using a definition from `lang-examples/nodejs/dbops/dbpgapp-helm/files/db/shell/dbdeploy.cmd`
* Deploy a NodeJS application image build using the Dockerfile `lang-examples/nodejs/dbops/app`. You will need to update the Helm chart to pickup different images as required
* Create an Ingress to act as a public endpoint for the app

Running the App
---------------
The app has various endpoints you can use to interact with the CosmosDB database. These are shown below.

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
This code does not have any unit testing or SA analysis run as part of the CI process

References
----------
- https://docs.npmjs.com
- https://www.w3schools.io/file/properties-read-write-javascript/
- https://nodejs.org/en/docs/



