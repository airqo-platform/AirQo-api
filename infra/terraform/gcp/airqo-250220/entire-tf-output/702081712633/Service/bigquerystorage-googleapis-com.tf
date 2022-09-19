resource "google_project_service" "bigquerystorage_googleapis_com" {
  project = "702081712633"
  service = "bigquerystorage.googleapis.com"
}
# terraform import google_project_service.bigquerystorage_googleapis_com 702081712633/bigquerystorage.googleapis.com
