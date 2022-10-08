resource "google_compute_route" "kubernetes_39e0b565_b7d5_4fa4_a057_04aa9c0314d0" {
  description       = "k8s-node-route"
  dest_range        = "10.244.0.0/24"
  name              = "kubernetes-39e0b565-b7d5-4fa4-a057-04aa9c0314d0"
  network           = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/pipeline-k8s-cluster"
  next_hop_instance = "projects/${var.project-id}/zones/us-central1-a/instances/pipeline-k8s-controller"
  priority          = 1000
  project           = var.project-id
}
# terraform import google_compute_route.kubernetes_39e0b565_b7d5_4fa4_a057_04aa9c0314d0 projects/${var.project-id}/global/routes/kubernetes-39e0b565-b7d5-4fa4-a057-04aa9c0314d0
