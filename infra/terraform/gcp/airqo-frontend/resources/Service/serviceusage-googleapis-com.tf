resource "google_project_service" "serviceusage_googleapis_com" {
  project = "4127550141"
  service = "serviceusage.googleapis.com"
}
# terraform import google_project_service.serviceusage_googleapis_com 4127550141/serviceusage.googleapis.com
