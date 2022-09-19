resource "google_project_service" "cloudfunctions_googleapis_com" {
  project = "4127550141"
  service = "cloudfunctions.googleapis.com"
}
# terraform import google_project_service.cloudfunctions_googleapis_com 4127550141/cloudfunctions.googleapis.com
