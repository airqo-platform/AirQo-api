resource "google_compute_firewall" "airqo_jenkins" {
  allow {
    ports    = ["8080", "5000", "3000"]
    protocol = "tcp"
  }

  description   = "accessing Jenkins on port 8080"
  direction     = "INGRESS"
  name          = "airqo-jenkins"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_jenkins projects/airqo-250220/global/firewalls/airqo-jenkins
