ARG pythonVersion=3.12.9
FROM python:${pythonVersion}-alpine AS builder

RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade \
    && apk add --no-cache curl cargo

WORKDIR /app

COPY requirements.txt .
COPY resources ./resources
COPY templates ./templates
COPY contexts ./contexts
COPY app.py .

RUN pip install -r requirements.txt
#RUN pip-review --auto
#RUN pip list

ARG account=chatbot
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account} 

CMD ["python3","app.py"]
