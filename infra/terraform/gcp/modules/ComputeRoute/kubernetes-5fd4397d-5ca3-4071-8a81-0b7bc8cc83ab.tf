resource "google_compute_route" "kubernetes_5fd4397d_5ca3_4071_8a81_0b7bc8cc83ab" {
  description       = "k8s-node-route"
  dest_range        = "10.244.1.0/24"
  name              = "kubernetes-5fd4397d-5ca3-4071-8a81-0b7bc8cc83ab"
  network           = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/pipeline-k8s-cluster"
  next_hop_instance = "projects/${var.project-id}/zones/us-central1-a/instances/pipeline-k8s-worker-0"
  priority          = 1000
  project           = var.project-id
}
# terraform import google_compute_route.kubernetes_5fd4397d_5ca3_4071_8a81_0b7bc8cc83ab projects/${var.project-id}/global/routes/kubernetes-5fd4397d-5ca3-4071-8a81-0b7bc8cc83ab
