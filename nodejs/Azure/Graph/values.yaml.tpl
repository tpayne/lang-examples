applicationName: "graphql-sample"

customResources:
  enabled: true
  resources:
    configMapData: |
      apiVersion: v1
      kind: ConfigMap
      metadata:
        name: app-config
        labels:
      data:
        app.properties: |-
          port=3000
          # Queries
          QUERY_FILE=/sql/query.txt

    configMapEnv: |
      apiVersion: v1
      kind: ConfigMap
      metadata:
        name: app-env-config
        labels:
      data:
        token.file: |-
          # Token details
          $TOKEN_FILE

containerImage:
  repository: ghcr.io/tpayne/nodejsazurequery # Optional. Repo to which the image resides
  tag: master # Optional. Image Tag (Defaults to latest)
  pullPolicy: Always

hasVolume:
  - name: app-config
    mountPath: /config/
  - name: app-env-config
    mountPath: /config-data/
  
configMaps:
  app-config:
    as: volume
    mountPath: /config/
  app-env-config:
    as: volume
    mountPath: /config-data/

ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: addon-http-application-routing
    #nginx.ingress.kubernetes.io/use-regex: "true"
    #nginx.ingress.kubernetes.io/rewrite-target: /$2
  #path: /aztables(/|$)(.*)
  path: /
  pathType: Prefix
  servicePort: app
  hosts:
    - restapi.ukwest.cloudapp.azure.com

service:
  enabled: true
  ports:
    app:
      port: 80
      targetPort: 3000
      protocol: TCP

containerPorts:
  app:
    port: 3000
    protocol: TCP

horizontalPodAutoscaler:
  enabled: true
  minReplicas: 2
  maxReplicas: 10

livenessProbe:
  httpGet:
    path: /version
    port: app

readinessProbe:
  httpGet:
    path: /version
    port: app

podAnnotations:
  azure.workload.identity/use: "true"

additionalDeploymentLabels:
  azure.workload.identity/use: "true"

envVars:
  AZURE_TENANT_ID: "${TENANT_ID}"
  AZURE_CLIENT_ID: "${CLIENT_ID}"
  # AZURE_FEDERATED_TOKEN_FILE: /config-data/token.file

serviceAccount:
  create: true
  name: aks-access
  labels:
    azure.workload.identity/use: "true"
  annotations:
    azure.workload.identity/tenant-id: "${TENANT_ID}"
    azure.workload.identity/client-id: "${CLIENT_ID}"

# serviceMonitor:
#   enabled: true
#   namespace: monitoring
#   endpoints:
#     default:
#       interval: 10s
#       scrapeTimeout: 10s
#       honorLabels: true
#       path: /metrics
#       port: http
#       scheme: http