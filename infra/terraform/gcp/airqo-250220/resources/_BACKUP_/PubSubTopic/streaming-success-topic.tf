resource "google_pubsub_topic" "streaming_success_topic" {
  name    = "streaming_success_topic"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.streaming_success_topic projects/airqo-250220/topics/streaming_success_topic
