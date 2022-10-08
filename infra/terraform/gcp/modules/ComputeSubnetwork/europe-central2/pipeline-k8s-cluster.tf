resource "google_compute_subnetwork" "pipeline_k8s_cluster" {
  ip_cidr_range = "10.186.0.0/20"
  name          = "pipeline-k8s-cluster"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  project       = "${var.project-id}"
  purpose       = "PRIVATE"
  region        = "europe-central2"
  stack_type    = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.pipeline_k8s_cluster projects/airqo-250220/regions/europe-central2/subnetworks/pipeline-k8s-cluster
