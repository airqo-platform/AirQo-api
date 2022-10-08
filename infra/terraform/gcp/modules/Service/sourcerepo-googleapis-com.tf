resource "google_project_service" "sourcerepo_googleapis_com" {
  project = "${var.project-number}"
  service = "sourcerepo.googleapis.com"
}
# terraform import google_project_service.sourcerepo_googleapis_com ${var.project-number}/sourcerepo.googleapis.com
