resource "google_compute_subnetwork" "pipeline_k8s_cluster" {
  ip_cidr_range = "10.152.0.0/20"
  name          = "pipeline-k8s-cluster"
  network       = "pipeline-k8s-cluster"
  project       = var.project-id
  purpose       = "PRIVATE"
  region        = "australia-southeast1"
  stack_type    = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.pipeline_k8s_cluster projects/${var.project-id}/regions/australia-southeast1/subnetworks/pipeline-k8s-cluster
