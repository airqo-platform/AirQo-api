resource "google_project_service" "bigquerystorage_googleapis_com" {
  project = "${var.project-number}"
  service = "bigquerystorage.googleapis.com"
}
# terraform import google_project_service.bigquerystorage_googleapis_com ${var.project-number}/bigquerystorage.googleapis.com
