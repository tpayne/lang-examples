FROM gcc:latest AS build
RUN apt-get install libssl-dev -y
RUN apt-get update

ARG TARGET=debug
ARG PLATFORM=mac

WORKDIR /src
COPY *.cpp /src/
COPY *.h /src/
COPY makefile /src/
RUN  mkdir /src/platform/
COPY platform/* /src/platform/

RUN gmake PLATFORM=${PLATFORM} TARGET=${TARGET} clean all

FROM gcc:latest
RUN apt-get update

ARG TARGET=debug
ARG PLATFORM=mac

WORKDIR /app
COPY --from=build /src/${PLATFORM}_${TARGET}/MessengerUtils ./MessengerUtils
CMD ["./MessengerUtils"]


