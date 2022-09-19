resource "google_project_service" "cloudscheduler_googleapis_com" {
  project = "4127550141"
  service = "cloudscheduler.googleapis.com"
}
# terraform import google_project_service.cloudscheduler_googleapis_com 4127550141/cloudscheduler.googleapis.com
