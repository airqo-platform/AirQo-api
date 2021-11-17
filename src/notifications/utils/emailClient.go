package utils

import (
	"airqo/notifications/config"
	"bytes"
	"fmt"
	"net/mail"
	"net/smtp"
)

func SendMail(recipient string, body bytes.Buffer) (bool, string) {

	_, parseError := mail.ParseAddress(recipient)
	if parseError != nil {
		return false, "Invalid Email Address"
	}

	to := []string{
		recipient,
	}

	smtpConfig := config.SmtpConfig()

	auth := smtp.PlainAuth("", smtpConfig.SmtpSender, smtpConfig.SmtpPassword, smtpConfig.SmtpHost)

	var err = smtp.SendMail(smtpConfig.SmtpHost+":"+smtpConfig.SmtpPort, auth, smtpConfig.SmtpSender, to, body.Bytes())
	if err != nil {
		err.Error()
		fmt.Println(err)
		return false, err.Error()
	}

	return true, "Message sent"
}
