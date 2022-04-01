package utils

import (
	"airqo/notifications/models"
	"context"
	"firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"fmt"
	"log"
)

func SendAppNotification(notification models.AppNotificationModel) {

	ctx := context.Background()
	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Fatalf("error initializing app: %v\n", err)
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		log.Fatalf("error getting Messaging client: %v\n", err)
	}

	message := &messaging.Message{
		Data: map[string]string{
			"token": notification.Token,
		},
		Token: notification.Token,
	}

	response, err := client.Send(ctx, message)
	if err != nil {
		fmt.Println("Failed to send message:", err)
	}

	fmt.Println("Successfully sent message:", response)

}
