resource "google_pubsub_topic" "event" {
  name    = "event"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.event projects/airqo-250220/topics/event
