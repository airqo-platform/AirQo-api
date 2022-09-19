resource "google_project_service" "servicemanagement_googleapis_com" {
  project = "4127550141"
  service = "servicemanagement.googleapis.com"
}
# terraform import google_project_service.servicemanagement_googleapis_com 4127550141/servicemanagement.googleapis.com
