# Batch fetch and Insertion
This module contains functions to fetch historical device measurements from KCCA and AirQo and feed them into the pipeline for transformation
## Environment Setup
```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
```
## Stream Measurements
Add the following files to this directory
>[.env file](https://docs.google.com/document/d/1vsShgi7LE3BnWLguxXbjXHaWQCnx9Q7Y259CFGlJHeQ/edit)
> 
>[Google Credentials file](https://drive.google.com/file/d/1i2cjGnOl8mftfXWGm5OIXWQrwQHhqkas/view?usp=sharing)
```bash
    python main.py
```
You should see a message that confirms that the measurements have been delivered to a topic on the pipeline.
## Verify Measurements
To verify whether the measuemrents exist on the topic and are ready for transformation, use any of the following. The `BOOTSTRAP_SERVERS` and `TOPIC` can be obtained for the `.env` file, depending on the `tenant`.
### Using kafkacat
```bash
kafkacat -P -b BOOTSTRAP_SERVERS -t TOPIC
```
### Using kafka 
[Quickstart to setup your environment](https://kafka.apache.org/quickstart)
```bash
bin/kafka-console-consumer.sh --topic TOPIC --from-beginning --bootstrap-server BOOTSTRAP_SERVERS
```
