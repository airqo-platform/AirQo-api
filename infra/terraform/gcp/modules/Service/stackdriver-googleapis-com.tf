resource "google_project_service" "stackdriver_googleapis_com" {
  project = var.project-number
  service = "stackdriver.googleapis.com"
}
# terraform import google_project_service.stackdriver_googleapis_com ${var.project-number}/stackdriver.googleapis.com
