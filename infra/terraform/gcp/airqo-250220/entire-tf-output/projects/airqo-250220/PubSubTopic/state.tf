resource "google_pubsub_topic" "state" {
  name    = "state"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.state projects/airqo-250220/topics/state
