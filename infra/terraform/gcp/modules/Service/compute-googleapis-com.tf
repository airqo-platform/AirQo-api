resource "google_project_service" "compute_googleapis_com" {
  project = var.project-number
  service = "compute.googleapis.com"
}
# terraform import google_project_service.compute_googleapis_com ${var.project-number}/compute.googleapis.com
