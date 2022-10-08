resource "google_project_service" "replicapool_googleapis_com" {
  project = "${var.project-number}"
  service = "replicapool.googleapis.com"
}
# terraform import google_project_service.replicapool_googleapis_com ${var.project-number}/replicapool.googleapis.com
