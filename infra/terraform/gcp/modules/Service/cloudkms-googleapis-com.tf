resource "google_project_service" "cloudkms_googleapis_com" {
  project = var.project-number
  service = "cloudkms.googleapis.com"
}
# terraform import google_project_service.cloudkms_googleapis_com ${var.project-number}/cloudkms.googleapis.com
