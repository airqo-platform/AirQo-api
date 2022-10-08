resource "google_project_service" "container_googleapis_com" {
  project = var.project-number
  service = "container.googleapis.com"
}
# terraform import google_project_service.container_googleapis_com ${var.project-number}/container.googleapis.com
