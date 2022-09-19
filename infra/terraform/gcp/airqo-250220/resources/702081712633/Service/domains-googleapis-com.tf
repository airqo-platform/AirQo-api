resource "google_project_service" "domains_googleapis_com" {
  project = "702081712633"
  service = "domains.googleapis.com"
}
# terraform import google_project_service.domains_googleapis_com 702081712633/domains.googleapis.com
