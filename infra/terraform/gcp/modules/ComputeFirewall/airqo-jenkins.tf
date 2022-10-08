resource "google_compute_firewall" "airqo_jenkins" {
  allow {
    ports    = ["8080", "5000", "3000"]
    protocol = "tcp"
  }

  description   = "accessing Jenkins on port 8080"
  direction     = "INGRESS"
  name          = "airqo-jenkins"
  network       = "airqo-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_jenkins projects/${var.project-id}/global/firewalls/airqo-jenkins
