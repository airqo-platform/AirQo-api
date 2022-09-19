resource "google_project_service" "iap_googleapis_com" {
  project = "4127550141"
  service = "iap.googleapis.com"
}
# terraform import google_project_service.iap_googleapis_com 4127550141/iap.googleapis.com
