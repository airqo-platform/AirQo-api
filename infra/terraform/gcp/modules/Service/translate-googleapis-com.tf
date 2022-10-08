resource "google_project_service" "translate_googleapis_com" {
  project = "${var.project-number}"
  service = "translate.googleapis.com"
}
# terraform import google_project_service.translate_googleapis_com ${var.project-number}/translate.googleapis.com
