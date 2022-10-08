resource "google_project_service" "vision_googleapis_com" {
  project = var.project-number
  service = "vision.googleapis.com"
}
# terraform import google_project_service.vision_googleapis_com ${var.project-number}/vision.googleapis.com
