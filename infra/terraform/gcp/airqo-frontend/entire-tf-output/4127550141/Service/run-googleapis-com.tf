resource "google_project_service" "run_googleapis_com" {
  project = "4127550141"
  service = "run.googleapis.com"
}
# terraform import google_project_service.run_googleapis_com 4127550141/run.googleapis.com
