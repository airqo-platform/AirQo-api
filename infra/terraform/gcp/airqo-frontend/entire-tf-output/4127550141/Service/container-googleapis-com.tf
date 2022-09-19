resource "google_project_service" "container_googleapis_com" {
  project = "4127550141"
  service = "container.googleapis.com"
}
# terraform import google_project_service.container_googleapis_com 4127550141/container.googleapis.com
