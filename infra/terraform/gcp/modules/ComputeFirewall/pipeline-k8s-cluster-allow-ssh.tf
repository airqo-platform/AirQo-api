resource "google_compute_firewall" "pipeline_k8s_cluster_allow_ssh" {
  allow {
    ports    = ["22"]
    protocol = "tcp"
  }

  description   = "Allows TCP connections from any source to any instance on the network using port 22."
  direction     = "INGRESS"
  name          = "pipeline-k8s-cluster-allow-ssh"
  network       = "pipeline-k8s-cluster"
  priority      = 65534
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.pipeline_k8s_cluster_allow_ssh projects/${var.project-id}/global/firewalls/pipeline-k8s-cluster-allow-ssh
