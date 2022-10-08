resource "google_pubsub_topic" "get_pm25categorycount_for_locations" {
  name    = "get_pm25categorycount_for_locations"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.get_pm25categorycount_for_locations projects/airqo-250220/topics/get_pm25categorycount_for_locations
