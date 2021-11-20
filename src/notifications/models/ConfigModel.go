package models

type ConfigModel struct {
	SmtpHost          string
	SmtpPort          string
	SmtpPassword      string
	SmtpSender        string
	BootstrapServers  []string
	ConsumerTopics    string
	AppConsumerTopics string
	ProducerTopics    string
}
