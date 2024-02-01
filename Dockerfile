FROM python:alpine

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY test_server.py .

CMD ["quart", "--app", "test_server", "run", "--host", "0.0.0.0"]