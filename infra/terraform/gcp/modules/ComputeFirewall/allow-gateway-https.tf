resource "google_compute_firewall" "allow_gateway_https" {
  allow {
    ports    = ["31271"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "allow-gateway-https"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/pipeline-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.allow_gateway_https projects/${var.project-id}/global/firewalls/allow-gateway-https
