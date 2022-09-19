resource "google_project_service" "appengine_googleapis_com" {
  project = "4127550141"
  service = "appengine.googleapis.com"
}
# terraform import google_project_service.appengine_googleapis_com 4127550141/appengine.googleapis.com
