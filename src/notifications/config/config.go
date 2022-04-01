package config

import (
	"airqo/notifications/models"
	"github.com/joho/godotenv"
	"log"
	"os"
	"strings"
)

func LoadConfig() {
	log.SetPrefix("env file: ")
	log.SetFlags(0)

	err := godotenv.Load("config/.env")
	if err != nil {
		var Error = log.New(os.Stdout, "\u001b[31mConfig error: \u001b[0m", log.LstdFlags|log.Lshortfile)
		Error.Println("Error loading .env file")
	}
}

func SmtpConfig() *models.ConfigModel {
	return &models.ConfigModel{
		SmtpHost:     os.Getenv("SMTP_HOST"),
		SmtpPort:     os.Getenv("SMTP_PORT"),
		SmtpPassword: os.Getenv("SMTP_PASSWORD"),
		SmtpSender:   os.Getenv("SMTP_DEFAULT_SENDER"),
	}
}

func KafkaConfig() *models.ConfigModel {
	return &models.ConfigModel{
		BootstrapServers:  strings.Split(os.Getenv("BOOTSTRAP_SERVERS"), ","),
		ConsumerTopics:    os.Getenv("CONSUMER_TOPICS"),
		AppConsumerTopics: os.Getenv("APP_CONSUMER_TOPICS"),
		ProducerTopics:    os.Getenv("PRODUCER_TOPICS"),
	}
}
