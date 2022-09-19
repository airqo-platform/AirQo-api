resource "google_project_service" "bigquerystorage_googleapis_com" {
  project = "4127550141"
  service = "bigquerystorage.googleapis.com"
}
# terraform import google_project_service.bigquerystorage_googleapis_com 4127550141/bigquerystorage.googleapis.com
