package utils

import (
	"airqo/notifications/config"
	"context"
	"fmt"
	"github.com/segmentio/kafka-go"
	"log"
	"os"
)

func ProduceMessages() {

	connectorConfig := config.KafkaConfig()

	w := &kafka.Writer{
		Addr:     kafka.TCP(connectorConfig.BootstrapServers...),
		Topic:    connectorConfig.ProducerTopics,
		Balancer: &kafka.LeastBytes{},
	}

	err := w.WriteMessages(context.Background(),
		kafka.Message{
			Key:   []byte("Key"),
			Value: []byte("Mobile App Alert!"),
		},
	)

	var Error = log.New(os.Stdout, "\u001b[31mKafka producer error: \u001b[0m", log.LstdFlags|log.Lshortfile)

	if err != nil {
		Error.Println("failed to write messages:", err)
	}

	if err := w.Close(); err != nil {
		Error.Println("failed to close writer:", err)
	}
}

func ConsumeAppMessages(ctx context.Context) {

	connectorConfig := config.KafkaConfig()

	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: connectorConfig.BootstrapServers,
		Topic:   connectorConfig.AppConsumerTopics,
	})

	for {
		m, err := r.FetchMessage(context.Background())
		if err != nil {
			break
		}
		fmt.Printf("message at offset %d: %s = %s\n", m.Offset, string(m.Key), string(m.Value))
	}

	if err := r.Close(); err != nil {
		log.Fatal("failed to close reader:", err)
	}
}

func ConsumeMessages(ctx context.Context) {

	connectorConfig := config.KafkaConfig()

	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: connectorConfig.BootstrapServers,
		Topic:   connectorConfig.ConsumerTopics,
	})

	for {
		m, err := r.ReadMessage(ctx)
		if err != nil {
			break
		}
		fmt.Printf("message at offset %d: %s = %s\n", m.Offset, string(m.Key), string(m.Value))
	}

	if err := r.Close(); err != nil {
		var Error = log.New(os.Stdout, "\u001b[31mKafka consumer error: \u001b[0m", log.LstdFlags|log.Lshortfile)
		Error.Println("failed to close reader:")
	}
}
