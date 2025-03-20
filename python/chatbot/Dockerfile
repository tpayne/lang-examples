FROM python:3.8-alpine

WORKDIR /app

COPY requirements.txt .
COPY templates ./templates
COPY app.py .

RUN pip install -r requirements.txt

CMD ["python3","app.py"]
EXPOSE 8080
EXPOSE 80
