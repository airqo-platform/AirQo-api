resource "google_project_service" "ml_googleapis_com" {
  project = "${var.project-number}"
  service = "ml.googleapis.com"
}
# terraform import google_project_service.ml_googleapis_com ${var.project-number}/ml.googleapis.com
