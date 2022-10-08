resource "google_compute_firewall" "pipeline_k8s_allow_external" {
  allow {
    ports    = ["9090-9094"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "pipeline-k8s-allow-external"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  priority      = 1000
  project       = "${var.project-id}"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.pipeline_k8s_allow_external projects/airqo-250220/global/firewalls/pipeline-k8s-allow-external
