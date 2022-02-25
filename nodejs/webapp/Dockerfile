FROM node:stretch AS imagebuilder
WORKDIR /source

COPY *.js .

RUN npm install -g pkg
RUN pkg *.js -o nodeexe 

FROM node:slim

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./

CMD ["./nodeexe"]
EXPOSE 8080
