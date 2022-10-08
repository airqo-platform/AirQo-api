resource "google_project_service" "playintegrity_googleapis_com" {
  project = "${var.project-number}"
  service = "playintegrity.googleapis.com"
}
# terraform import google_project_service.playintegrity_googleapis_com ${var.project-number}/playintegrity.googleapis.com
