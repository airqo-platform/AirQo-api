resource "google_compute_firewall" "pipeline_k8s_cluster_allow_internal" {
  allow {
    protocol = "all"
  }

  description   = "Allows connections from any source in the network IP range to any instance on the network using all protocols."
  direction     = "INGRESS"
  name          = "pipeline-k8s-cluster-allow-internal"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/pipeline-k8s-cluster"
  priority      = 65534
  project       = var.project-id
  source_ranges = ["10.128.0.0/9"]
}
# terraform import google_compute_firewall.pipeline_k8s_cluster_allow_internal projects/${var.project-id}/global/firewalls/pipeline-k8s-cluster-allow-internal
