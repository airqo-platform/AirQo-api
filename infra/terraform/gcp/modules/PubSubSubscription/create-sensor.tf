resource "google_pubsub_subscription" "create_sensor" {
  ack_deadline_seconds       = 10
  message_retention_duration = "604800s"
  name                       = "create-sensor"
  project                    = "${var.project-id}"
  topic                      = "projects/airqo-250220/topics/sensor"
}
# terraform import google_pubsub_subscription.create_sensor projects/airqo-250220/subscriptions/create-sensor
