resource "google_project_service" "dns_googleapis_com" {
  project = "4127550141"
  service = "dns.googleapis.com"
}
# terraform import google_project_service.dns_googleapis_com 4127550141/dns.googleapis.com
