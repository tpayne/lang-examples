# Image builder...
FROM node:stretch AS imagebuilder
RUN apt-get update 
WORKDIR /source

COPY *.js .

RUN npm install -g pkg
RUN npm install properties-reader 
RUN pkg -t node16 *.js -o nodeexe 

# Image runner...
FROM node:slim
RUN apt-get update 
ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account} 

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY html ./html
COPY config ./config

USER ${account}:${account}

CMD ["./nodeexe"]
EXPOSE 8080
