import json

from confluent_kafka import Producer

from config import configuration


class KafkaWithoutRegistry:

    boot_strap_servers = None
    topic = None

    def __init__(self, boot_strap_servers, topic) -> None:
        self.boot_strap_servers = boot_strap_servers
        self.topic = topic
        super().__init__()

    def __delivery_report(self, err, msg):
        if err is not None:
            print(f'Message delivery to Bootstrap servers `{self.boot_strap_servers}`, '
                  f'topic `{self.topic}` failed. Error : {err}')
        else:
            print('Message delivered to {} [{}]'.format(msg.topic(), msg.partition()))

    def produce(self, data):

        if data:
            n = int(configuration.INSERTION_INTERVAL)
            sub_lists = [data[i * n:(i + 1) * n] for i in range((len(data) + n - 1) // n)]

            for sub_list in sub_lists:

                data = json.dumps(sub_list)
                p = Producer({'bootstrap.servers': self.boot_strap_servers})
                p.produce(self.topic, data.encode('utf-8'), callback=self.__delivery_report)
                p.flush()
