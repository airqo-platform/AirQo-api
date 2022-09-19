resource "google_project_service" "runtimeconfig_googleapis_com" {
  project = "4127550141"
  service = "runtimeconfig.googleapis.com"
}
# terraform import google_project_service.runtimeconfig_googleapis_com 4127550141/runtimeconfig.googleapis.com
