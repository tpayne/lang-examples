FROM gcc:latest
RUN apt-get update

WORKDIR /app
COPY *.cpp /app
COPY *.h /app
COPY Makefile /app

RUN gmake clean
RUN gmake all
