resource "google_project_service" "appengine_googleapis_com" {
  project = "702081712633"
  service = "appengine.googleapis.com"
}
# terraform import google_project_service.appengine_googleapis_com 702081712633/appengine.googleapis.com
