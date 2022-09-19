resource "google_project_service" "domains_googleapis_com" {
  project = "4127550141"
  service = "domains.googleapis.com"
}
# terraform import google_project_service.domains_googleapis_com 4127550141/domains.googleapis.com
