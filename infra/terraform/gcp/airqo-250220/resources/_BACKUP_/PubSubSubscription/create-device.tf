resource "google_pubsub_subscription" "create_device" {
  ack_deadline_seconds       = 10
  message_retention_duration = "604800s"
  name                       = "create-device"
  project                    = "airqo-250220"
  topic                      = "projects/airqo-250220/topics/device"
}
# terraform import google_pubsub_subscription.create_device projects/airqo-250220/subscriptions/create-device
