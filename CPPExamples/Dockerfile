FROM gcc:latest AS build
RUN apt-get update

WORKDIR /src
COPY *.cpp /src/
COPY *.h /src/
COPY Makefile /src/

RUN gmake clean all

FROM ubuntu:latest
RUN apt-get update

WORKDIR /app
COPY --from=build /src ./
CMD ["./main"]


