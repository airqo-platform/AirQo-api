resource "google_project_service" "dataflow_googleapis_com" {
  project = "702081712633"
  service = "dataflow.googleapis.com"
}
# terraform import google_project_service.dataflow_googleapis_com 702081712633/dataflow.googleapis.com
