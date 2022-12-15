FROM mcr.microsoft.com/dotnet/sdk:6.0-focal AS build

# If you are building on M1 chipsets (Mac), then use this instead
#FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/sdk:5.0-focal AS build

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
RUN dotnet restore -r linux-x64 /p:PublishReadyToRun=true
RUN dotnet publish -c release -o /app -r linux-x64 --self-contained true --no-restore /p:PublishTrimmed=true \
	/p:PublishReadyToRun=true /p:PublishSingleFile=true

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:5.0-focal-amd64

# If you are building on M1 chipsets (Mac), then use this instead
#FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/aspnet:5.0-focal-amd64

WORKDIR /app
COPY --from=build /app ./
CMD ["./WebRestAPI"]
EXPOSE 80

