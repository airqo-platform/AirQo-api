resource "google_project_service" "fcm_googleapis_com" {
  project = "702081712633"
  service = "fcm.googleapis.com"
}
# terraform import google_project_service.fcm_googleapis_com 702081712633/fcm.googleapis.com
