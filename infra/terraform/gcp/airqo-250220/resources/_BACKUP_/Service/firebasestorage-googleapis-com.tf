resource "google_project_service" "firebasestorage_googleapis_com" {
  project = "702081712633"
  service = "firebasestorage.googleapis.com"
}
# terraform import google_project_service.firebasestorage_googleapis_com 702081712633/firebasestorage.googleapis.com
