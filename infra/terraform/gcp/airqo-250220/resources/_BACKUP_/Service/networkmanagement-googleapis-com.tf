resource "google_project_service" "networkmanagement_googleapis_com" {
  project = "702081712633"
  service = "networkmanagement.googleapis.com"
}
# terraform import google_project_service.networkmanagement_googleapis_com 702081712633/networkmanagement.googleapis.com
