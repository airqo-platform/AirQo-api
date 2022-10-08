resource "google_project_service" "sqladmin_googleapis_com" {
  project = var.project-number
  service = "sqladmin.googleapis.com"
}
# terraform import google_project_service.sqladmin_googleapis_com ${var.project-number}/sqladmin.googleapis.com
