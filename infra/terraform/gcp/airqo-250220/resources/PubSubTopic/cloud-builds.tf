resource "google_pubsub_topic" "cloud_builds" {
  name    = "cloud-builds"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.cloud_builds projects/airqo-250220/topics/cloud-builds
