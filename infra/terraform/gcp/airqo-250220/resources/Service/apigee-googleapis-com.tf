resource "google_project_service" "apigee_googleapis_com" {
  project = "702081712633"
  service = "apigee.googleapis.com"
}
# terraform import google_project_service.apigee_googleapis_com 702081712633/apigee.googleapis.com
