resource "google_pubsub_topic" "get_us_embassy_data" {
  name    = "get_us_embassy_data"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.get_us_embassy_data projects/airqo-250220/topics/get_us_embassy_data
