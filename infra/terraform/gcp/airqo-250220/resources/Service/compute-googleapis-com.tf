resource "google_project_service" "compute_googleapis_com" {
  project = "702081712633"
  service = "compute.googleapis.com"
}
# terraform import google_project_service.compute_googleapis_com 702081712633/compute.googleapis.com
