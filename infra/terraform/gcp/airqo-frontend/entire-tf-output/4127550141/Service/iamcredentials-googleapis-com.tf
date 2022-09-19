resource "google_project_service" "iamcredentials_googleapis_com" {
  project = "4127550141"
  service = "iamcredentials.googleapis.com"
}
# terraform import google_project_service.iamcredentials_googleapis_com 4127550141/iamcredentials.googleapis.com
