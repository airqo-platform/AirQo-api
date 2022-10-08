resource "google_compute_firewall" "allow_gateway_https" {
  allow {
    ports    = ["31271"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "allow-gateway-https"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  priority      = 1000
  project       = "${var.project-id}"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.allow_gateway_https projects/airqo-250220/global/firewalls/allow-gateway-https
