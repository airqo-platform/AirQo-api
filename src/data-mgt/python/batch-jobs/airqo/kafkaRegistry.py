from confluent_kafka import Producer


class Kafka:

    boot_strap_servers = None
    topic = None

    def __init__(self, boot_strap_servers, topic) -> None:
        self.boot_strap_servers = boot_strap_servers
        self.topic = topic
        super().__init__()

    def delivery_report(self, err, msg):
        if err is not None:
            print(f'Message delivery to Bootstrap servers `{self.boot_strap_servers}`, '
                  f'topic `{self.topic}` failed. Error : {err}')
        else:
            print('Message delivered to {} [{}]'.format(msg.topic(), msg.partition()))

    def produce(self, value):

        p = Producer({'bootstrap.servers': self.boot_strap_servers})
        p.produce(self.topic, value.encode('utf-8'), callback=self.delivery_report)

        # Wait for any outstanding messages to be delivered and delivery report
        # callbacks to be triggered.
        p.flush()

