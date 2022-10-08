resource "google_project_service" "artifactregistry_googleapis_com" {
  project = "${var.project-number}"
  service = "artifactregistry.googleapis.com"
}
# terraform import google_project_service.artifactregistry_googleapis_com ${var.project-number}/artifactregistry.googleapis.com
