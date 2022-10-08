resource "google_pubsub_subscription" "create_event" {
  ack_deadline_seconds       = 10
  message_retention_duration = "604800s"
  name                       = "create-event"
  project                    = var.project-id
  topic                      = "projects/${var.project-id}/topics/event"
}
# terraform import google_pubsub_subscription.create_event projects/${var.project-id}/subscriptions/create-event
