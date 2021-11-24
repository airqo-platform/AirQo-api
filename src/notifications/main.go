package main

import (
	"airqo/notifications/config"
	"airqo/notifications/controllers"
	"github.com/gin-gonic/gin"
)

func main() {

	config.LoadConfig()

	//ctx := context.Background()
	//utils.ConsumeMessages(ctx)
	//utils.ConsumeAppMessages(ctx)

	router := gin.Default()
	router.POST("api/v1/notifications/welcomeMessage", controllers.SendWelcomeMessage)

	err := router.Run(":8080")
	if err != nil {
		return
	}
}
