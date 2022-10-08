resource "google_project_service" "dlp_googleapis_com" {
  project = "${var.project-number}"
  service = "dlp.googleapis.com"
}
# terraform import google_project_service.dlp_googleapis_com ${var.project-number}/dlp.googleapis.com
