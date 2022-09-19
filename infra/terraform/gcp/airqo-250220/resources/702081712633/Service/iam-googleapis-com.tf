resource "google_project_service" "iam_googleapis_com" {
  project = "702081712633"
  service = "iam.googleapis.com"
}
# terraform import google_project_service.iam_googleapis_com 702081712633/iam.googleapis.com
