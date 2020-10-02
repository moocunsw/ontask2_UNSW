FROM alpine:3.7

RUN apk add --no-cache build-base python3 python3-dev libffi-dev libressl-dev postgresql-dev linux-headers

RUN pip3 install cython==0.29.21
RUN pip3 install pandas==1.1.1

COPY requirements.txt /
RUN pip3 install -r /requirements.txt

ADD ./ /backend
WORKDIR /backend

EXPOSE 8000
