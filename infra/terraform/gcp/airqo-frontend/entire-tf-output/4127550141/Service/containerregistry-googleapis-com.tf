resource "google_project_service" "containerregistry_googleapis_com" {
  project = "4127550141"
  service = "containerregistry.googleapis.com"
}
# terraform import google_project_service.containerregistry_googleapis_com 4127550141/containerregistry.googleapis.com
