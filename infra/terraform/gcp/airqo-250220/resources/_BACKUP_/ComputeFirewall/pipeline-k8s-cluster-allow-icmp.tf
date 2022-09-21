resource "google_compute_firewall" "pipeline_k8s_cluster_allow_icmp" {
  allow {
    protocol = "icmp"
  }

  description   = "Allows ICMP connections from any source to any instance on the network."
  direction     = "INGRESS"
  name          = "pipeline-k8s-cluster-allow-icmp"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  priority      = 65534
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.pipeline_k8s_cluster_allow_icmp projects/airqo-250220/global/firewalls/pipeline-k8s-cluster-allow-icmp
