resource "google_project_service" "osconfig_googleapis_com" {
  project = "702081712633"
  service = "osconfig.googleapis.com"
}
# terraform import google_project_service.osconfig_googleapis_com 702081712633/osconfig.googleapis.com
