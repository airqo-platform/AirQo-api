resource "google_project_service" "iam_googleapis_com" {
  project = "4127550141"
  service = "iam.googleapis.com"
}
# terraform import google_project_service.iam_googleapis_com 4127550141/iam.googleapis.com
