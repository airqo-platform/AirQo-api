resource "google_project_service" "dataproc_googleapis_com" {
  project = "702081712633"
  service = "dataproc.googleapis.com"
}
# terraform import google_project_service.dataproc_googleapis_com 702081712633/dataproc.googleapis.com
