# TLS in Mainflux MQTT

## Key and Certificate Generation

Use `generate-CA.sh` script (described [here](http://rockingdlabs.dunmire.org/exercises-experiments/ssl-client-certs-to-secure-mqtt)):

For server-side certificates:
```
generate-CA.sh mainflux-server
```

For client side certificates:
```
generate-CA.sh client mainflux-client
```

Then you can SUB with something like:
```
mosquitto_sub -t mainflux/channels/a57cc963-c152-4fd2-9398-59495916babe -p 8883 -v --cafile ./certs/ca.crt
```

or PUB with something like:
```
mosquitto_pub -t mainflux/channels/a57cc963-c152-4fd2-9398-59495916babe -m '[{"bn":"AAAAA","bt":1.276020076001e+09, "bu":"A","bver":5, "n":"voltage","u":"V","v":120.1}, {"n":"current","t":-5,"v":1.2}, {"n":"current","t":-4,"v":1.3}]' -p 8883 --cafile ./certs/ca.crt
```

### CSR, CA and KEY
Following the instructions [here](https://help.github.com/enterprise/11.10.340/admin/articles/using-self-signed-ssl-certificates/), [here](http://uwsgi-docs.readthedocs.io/en/latest/HTTPS.html) and especially [here](http://www.shellhacks.com/en/HowTo-Create-CSR-using-OpenSSL-Without-Prompt-Non-Interactive)

Here is how we can do it:

- Create the CA root key:
```bash
openssl genrsa -out ca.key 2048
```

- Self-sign rootCA certificate
```
openssl req -x509 -new -nodes -key ca.key -sha256 -days 1024 -out ca.crt \
			-subj "/C=FR/ST=IDF/L=Paris/O=Mainflux/OU=IoT/CN=localhost"
```

- This can be done in one go:
```
openssl req -newkey rsa:2048 -x509 -nodes -sha512 -days 5475 -extensions v3_ca \
			-keyout ca.key -out ca.crt -subj /CN=localhost/O=Mainflux/OU=IoT/emailAddress=info@mainflux.com
```

- Generate new key and [CSR](https://en.wikipedia.org/wiki/Certificate_signing_request):
```bash
openssl req -new -sha512 -out mainflux-server.csr -key mainflux-server.key \
			-subj /CN=Lenin/O=Mainflux/OU=IoT/emailAddress=info@mainflux.com
```

- Use root CA key (`ca.key`) to sign CSR:
```
openssl x509 -req -sha512 -in mainflux-server.csr \
			-CA ca.crt -CAkey ca.key -CAcreateserial -CAserial ca.srl \
			-out mainflux-server.crt -days 5475 -extfile /tmp/cacnf.kAXcnZPl -extensions MFXextensions
```
