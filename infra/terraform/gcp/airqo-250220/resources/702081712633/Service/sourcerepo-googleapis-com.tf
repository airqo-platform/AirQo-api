resource "google_project_service" "sourcerepo_googleapis_com" {
  project = "702081712633"
  service = "sourcerepo.googleapis.com"
}
# terraform import google_project_service.sourcerepo_googleapis_com 702081712633/sourcerepo.googleapis.com
