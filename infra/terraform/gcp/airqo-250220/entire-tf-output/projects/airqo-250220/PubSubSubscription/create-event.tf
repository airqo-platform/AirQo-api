resource "google_pubsub_subscription" "create_event" {
  ack_deadline_seconds       = 10
  message_retention_duration = "604800s"
  name                       = "create-event"
  project                    = "airqo-250220"
  topic                      = "projects/airqo-250220/topics/event"
}
# terraform import google_pubsub_subscription.create_event projects/airqo-250220/subscriptions/create-event
