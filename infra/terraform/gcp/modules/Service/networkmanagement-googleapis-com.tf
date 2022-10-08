resource "google_project_service" "networkmanagement_googleapis_com" {
  project = var.project-number
  service = "networkmanagement.googleapis.com"
}
# terraform import google_project_service.networkmanagement_googleapis_com ${var.project-number}/networkmanagement.googleapis.com
