resource "google_project_service" "domains_googleapis_com" {
  project = "${var.project-number}"
  service = "domains.googleapis.com"
}
# terraform import google_project_service.domains_googleapis_com ${var.project-number}/domains.googleapis.com
