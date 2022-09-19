resource "google_pubsub_topic" "cloud_builds" {
  name    = "cloud-builds"
  project = "airqo-frontend"
}
# terraform import google_pubsub_topic.cloud_builds projects/airqo-frontend/topics/cloud-builds
