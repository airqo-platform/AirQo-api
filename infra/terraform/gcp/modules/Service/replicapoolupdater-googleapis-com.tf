resource "google_project_service" "replicapoolupdater_googleapis_com" {
  project = "${var.project-number}"
  service = "replicapoolupdater.googleapis.com"
}
# terraform import google_project_service.replicapoolupdater_googleapis_com ${var.project-number}/replicapoolupdater.googleapis.com
