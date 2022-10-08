resource "google_pubsub_topic" "temp_fetch" {
  name    = "temp_fetch"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.temp_fetch projects/airqo-250220/topics/temp_fetch
