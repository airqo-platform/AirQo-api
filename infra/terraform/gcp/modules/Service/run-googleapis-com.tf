resource "google_project_service" "run_googleapis_com" {
  project = "702081712633"
  service = "run.googleapis.com"
}
# terraform import google_project_service.run_googleapis_com 702081712633/run.googleapis.com
