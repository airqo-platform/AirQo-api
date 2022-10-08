resource "google_pubsub_subscription" "create_device" {
  ack_deadline_seconds       = 10
  message_retention_duration = "604800s"
  name                       = "create-device"
  project                    = var.project-id
  topic                      = "projects/${var.project-id}/topics/device"
}
# terraform import google_pubsub_subscription.create_device projects/${var.project-id}/subscriptions/create-device
