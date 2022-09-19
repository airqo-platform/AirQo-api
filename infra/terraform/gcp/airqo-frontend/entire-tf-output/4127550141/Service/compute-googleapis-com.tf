resource "google_project_service" "compute_googleapis_com" {
  project = "4127550141"
  service = "compute.googleapis.com"
}
# terraform import google_project_service.compute_googleapis_com 4127550141/compute.googleapis.com
