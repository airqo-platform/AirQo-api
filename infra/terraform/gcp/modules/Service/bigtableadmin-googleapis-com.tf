resource "google_project_service" "bigtableadmin_googleapis_com" {
  project = "${var.project-number}"
  service = "bigtableadmin.googleapis.com"
}
# terraform import google_project_service.bigtableadmin_googleapis_com ${var.project-number}/bigtableadmin.googleapis.com
