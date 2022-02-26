# Image builder...
FROM node:stretch AS imagebuilder
RUN apt update 
WORKDIR /source

COPY *.js .

RUN npm install -g pkg
RUN pkg *.js -o nodeexe 

# Image runner...
FROM node:slim
RUN apt update 
ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account} 

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY html ./html

USER ${account}:${account}

CMD ["./nodeexe"]
EXPOSE 8080
