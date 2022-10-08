resource "google_project_service" "securetoken_googleapis_com" {
  project = "${var.project-number}"
  service = "securetoken.googleapis.com"
}
# terraform import google_project_service.securetoken_googleapis_com ${var.project-number}/securetoken.googleapis.com
