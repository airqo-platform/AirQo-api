resource "google_project_service" "pubsub_googleapis_com" {
  project = "4127550141"
  service = "pubsub.googleapis.com"
}
# terraform import google_project_service.pubsub_googleapis_com 4127550141/pubsub.googleapis.com
