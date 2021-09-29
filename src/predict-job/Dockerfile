FROM python:3.7-slim

RUN apt update
RUN apt install libgomp1

COPY . /app/
WORKDIR /app/

RUN pip install -r requirements.txt

ENV ENV=production
CMD ["python", "main.py"]