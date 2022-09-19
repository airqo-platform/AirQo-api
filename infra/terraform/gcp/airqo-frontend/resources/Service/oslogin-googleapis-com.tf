resource "google_project_service" "oslogin_googleapis_com" {
  project = "4127550141"
  service = "oslogin.googleapis.com"
}
# terraform import google_project_service.oslogin_googleapis_com 4127550141/oslogin.googleapis.com
