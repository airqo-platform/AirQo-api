resource "google_project_service" "dns_googleapis_com" {
  project = "${var.project-number}"
  service = "dns.googleapis.com"
}
# terraform import google_project_service.dns_googleapis_com ${var.project-number}/dns.googleapis.com
