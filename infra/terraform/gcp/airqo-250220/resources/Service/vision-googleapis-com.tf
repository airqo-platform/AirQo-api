resource "google_project_service" "vision_googleapis_com" {
  project = "702081712633"
  service = "vision.googleapis.com"
}
# terraform import google_project_service.vision_googleapis_com 702081712633/vision.googleapis.com
