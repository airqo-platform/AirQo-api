resource "google_project_service" "datastore_googleapis_com" {
  project = "4127550141"
  service = "datastore.googleapis.com"
}
# terraform import google_project_service.datastore_googleapis_com 4127550141/datastore.googleapis.com
