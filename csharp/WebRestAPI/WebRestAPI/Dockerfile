FROM --platform=linux/arm64v8 mcr.microsoft.com/dotnet/sdk:7.0.102-alpine3.17-arm64v8 AS build

WORKDIR /source

# Do not want to copy everything, only what I need...
COPY *.json ./WebRestAPI/
COPY *.cs ./WebRestAPI/
COPY *.csproj ./WebRestAPI/
COPY *.sln ./WebRestAPI/

COPY Controllers ./WebRestAPI/
COPY Properties ./WebRestAPI/
COPY Models ./WebRestAPI/

WORKDIR /source/WebRestAPI/
RUN dotnet clean
RUN dotnet restore -r linux-arm64 /p:PublishReadyToRun=true
RUN dotnet publish -c release -o /app -r linux-arm64 --self-contained true --no-restore /p:PublishTrimmed=true \
	/p:PublishReadyToRunShowWarnings=true /p:PublishReadyToRun=true /p:PublishSingleFile=true

# final stage/image
FROM --platform=linux/arm64v8 mcr.microsoft.com/dotnet/aspnet:7.0.2-alpine3.17-arm64v8 AS runtime

WORKDIR /app
COPY --from=build /app ./
CMD ["./WebRestAPI"]
EXPOSE 80

