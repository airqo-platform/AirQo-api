resource "google_pubsub_subscription" "create_user" {
  ack_deadline_seconds       = 10
  message_retention_duration = "604800s"
  name                       = "create-user"
  project                    = "airqo-250220"
  topic                      = "projects/airqo-250220/topics/user"
}
# terraform import google_pubsub_subscription.create_user projects/airqo-250220/subscriptions/create-user
