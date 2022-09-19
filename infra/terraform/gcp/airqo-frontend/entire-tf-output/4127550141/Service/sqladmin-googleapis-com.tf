resource "google_project_service" "sqladmin_googleapis_com" {
  project = "4127550141"
  service = "sqladmin.googleapis.com"
}
# terraform import google_project_service.sqladmin_googleapis_com 4127550141/sqladmin.googleapis.com
