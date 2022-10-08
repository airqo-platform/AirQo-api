resource "google_project_service" "mobilecrashreporting_googleapis_com" {
  project = var.project-number
  service = "mobilecrashreporting.googleapis.com"
}
# terraform import google_project_service.mobilecrashreporting_googleapis_com ${var.project-number}/mobilecrashreporting.googleapis.com
