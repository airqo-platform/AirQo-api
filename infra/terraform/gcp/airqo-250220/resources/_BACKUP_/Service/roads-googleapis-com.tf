resource "google_project_service" "roads_googleapis_com" {
  project = "702081712633"
  service = "roads.googleapis.com"
}
# terraform import google_project_service.roads_googleapis_com 702081712633/roads.googleapis.com
