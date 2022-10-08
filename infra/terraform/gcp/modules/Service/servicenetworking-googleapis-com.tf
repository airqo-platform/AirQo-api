resource "google_project_service" "servicenetworking_googleapis_com" {
  project = var.project-number
  service = "servicenetworking.googleapis.com"
}
# terraform import google_project_service.servicenetworking_googleapis_com ${var.project-number}/servicenetworking.googleapis.com
