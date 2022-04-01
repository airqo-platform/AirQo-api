package controllers

import (
	"airqo/notifications/models"
	"airqo/notifications/utils"
	"bytes"
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
	"text/template"
)

func SendWelcomeMessage(c *gin.Context) {

	var messageModel models.WelcomeMessageModel
	if err := c.BindJSON(&messageModel); err != nil {
		return
	}

	var body bytes.Buffer
	mimeHeaders := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"

	var templatePath string

	if strings.Compare(messageModel.Platform, "mobile") == 0 {
		body.Write([]byte(fmt.Sprintf("Subject: AirQo Mobile App\n%s\n\n", mimeHeaders)))
		templatePath = "templates/mobile-welcome-email-template.html"
	} else if strings.Compare(messageModel.Platform, "netmanager") == 0 {
		body.Write([]byte(fmt.Sprintf("Subject: AirQo Netamanger Platform\n%s\n\n", mimeHeaders)))
		templatePath = "templates/netmanager-welcome-email-template.html"
	} else {
		body.Write([]byte(fmt.Sprintf("Subject: Welcome to AirQo \n%s\n\n", mimeHeaders)))
		templatePath = "templates/welcome-email-template.html"
	}
	bodyTemplate, _ := template.ParseFiles(templatePath)

	err := bodyTemplate.Execute(&body, struct {
		Name string
	}{
		Name: strings.ToUpper(messageModel.FirstName),
	})
	if err != nil {
		return
	}

	var success, message = utils.SendMail(messageModel.Email, body)

	var response models.HttpResponseModel

	if !success {
		response.Message = message
		c.IndentedJSON(http.StatusBadRequest, response)
	} else {
		response.Message = message
		c.IndentedJSON(http.StatusOK, response)
	}

}

func SendAppNotification(c *gin.Context) {

	var notification models.AppNotificationModel

	if err := c.BindJSON(&notification); err != nil {
		return
	}
	utils.SendAppNotification(notification)

	c.IndentedJSON(http.StatusOK, notification)
}
