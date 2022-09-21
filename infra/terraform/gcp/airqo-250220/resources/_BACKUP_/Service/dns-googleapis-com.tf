resource "google_project_service" "dns_googleapis_com" {
  project = "702081712633"
  service = "dns.googleapis.com"
}
# terraform import google_project_service.dns_googleapis_com 702081712633/dns.googleapis.com
