resource "google_project_service" "oslogin_googleapis_com" {
  project = "702081712633"
  service = "oslogin.googleapis.com"
}
# terraform import google_project_service.oslogin_googleapis_com 702081712633/oslogin.googleapis.com
