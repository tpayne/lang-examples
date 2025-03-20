ARG alpineVersion=3.8
FROM python:${alpineVersion}-alpine AS builder

RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /app

COPY requirements.txt .
COPY templates ./templates
COPY app.py .

RUN pip install -r requirements.txt

ARG account=chatbot
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account} 

CMD ["python3","app.py"]