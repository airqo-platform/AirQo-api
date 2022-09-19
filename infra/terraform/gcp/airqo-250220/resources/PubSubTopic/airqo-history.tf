resource "google_pubsub_topic" "airqo_history" {
  name    = "airqo-history"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.airqo_history projects/airqo-250220/topics/airqo-history
