resource "google_compute_subnetwork" "k8s_nodes" {
  ip_cidr_range              = "10.240.0.0/24"
  name                       = "k8s-nodes"
  network                    = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
  private_ipv6_google_access = "DISABLE_GOOGLE_ACCESS"
  project                    = "airqo-250220"
  purpose                    = "PRIVATE"
  region                     = "europe-west1"
  stack_type                 = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.k8s_nodes projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes
