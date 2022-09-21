resource "google_project_service" "cloudkms_googleapis_com" {
  project = "702081712633"
  service = "cloudkms.googleapis.com"
}
# terraform import google_project_service.cloudkms_googleapis_com 702081712633/cloudkms.googleapis.com
