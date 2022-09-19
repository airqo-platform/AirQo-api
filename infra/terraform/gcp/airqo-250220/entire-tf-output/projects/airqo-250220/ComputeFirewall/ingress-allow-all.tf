resource "google_compute_firewall" "ingress_allow_all" {
  allow {
    protocol = "all"
  }

  direction     = "INGRESS"
  name          = "ingress-allow-all"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.ingress_allow_all projects/airqo-250220/global/firewalls/ingress-allow-all
