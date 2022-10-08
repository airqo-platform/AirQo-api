resource "google_project_service" "identitytoolkit_googleapis_com" {
  project = var.project-number
  service = "identitytoolkit.googleapis.com"
}
# terraform import google_project_service.identitytoolkit_googleapis_com ${var.project-number}/identitytoolkit.googleapis.com
