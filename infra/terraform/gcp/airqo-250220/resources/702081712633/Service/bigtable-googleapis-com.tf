resource "google_project_service" "bigtable_googleapis_com" {
  project = "702081712633"
  service = "bigtable.googleapis.com"
}
# terraform import google_project_service.bigtable_googleapis_com 702081712633/bigtable.googleapis.com
