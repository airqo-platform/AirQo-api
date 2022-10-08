resource "google_compute_route" "kubernetes_b349179f_453a_4f88_bf20_ed7bdcd6f734" {
  description       = "k8s-node-route"
  dest_range        = "10.244.3.0/24"
  name              = "kubernetes-b349179f-453a-4f88-bf20-ed7bdcd6f734"
  network           = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  next_hop_instance = "projects/airqo-250220/zones/us-central1-a/instances/pipeline-k8s-worker-1"
  priority          = 1000
  project           = "${var.project-id}"
}
# terraform import google_compute_route.kubernetes_b349179f_453a_4f88_bf20_ed7bdcd6f734 projects/airqo-250220/global/routes/kubernetes-b349179f-453a-4f88-bf20-ed7bdcd6f734
