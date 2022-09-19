resource "google_project_service" "cloudapis_googleapis_com" {
  project = "4127550141"
  service = "cloudapis.googleapis.com"
}
# terraform import google_project_service.cloudapis_googleapis_com 4127550141/cloudapis.googleapis.com
