resource "google_project_service" "runtimeconfig_googleapis_com" {
  project = "702081712633"
  service = "runtimeconfig.googleapis.com"
}
# terraform import google_project_service.runtimeconfig_googleapis_com 702081712633/runtimeconfig.googleapis.com
