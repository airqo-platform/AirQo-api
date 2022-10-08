resource "google_project_service" "pubsub_googleapis_com" {
  project = "702081712633"
  service = "pubsub.googleapis.com"
}
# terraform import google_project_service.pubsub_googleapis_com 702081712633/pubsub.googleapis.com
