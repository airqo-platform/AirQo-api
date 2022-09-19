resource "google_pubsub_topic" "slack" {
  name    = "slack"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.slack projects/airqo-250220/topics/slack
