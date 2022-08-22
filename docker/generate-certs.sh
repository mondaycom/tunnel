openssl req -x509 -newkey rsa:2048 -keyout nginx/certs/key.pem -out nginx/certs/cert.pem -days 3650 -nodes -subj "/C=pl/CN=localhost"
