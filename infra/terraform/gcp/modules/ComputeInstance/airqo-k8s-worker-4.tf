resource "google_compute_instance" "airqo_k8s_worker_4" {
  name    = "airqo-k8s-worker-4"
  project = var.project_id
  zone    = var.zone

  machine_type = "c2-standard-8"

  boot_disk {
    auto_delete = false
    source      = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-k8s-worker-4"
  }

  metadata = {
    startup-script = "sudo ufw allow ssh"
  }

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }
    network    = "airqo-k8s-cluster"
    subnetwork = "k8s-nodes"
    network_ip = "10.240.0.22"
  }
  tags = ["airqo-k8s", "worker"]

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email = "${var.project_number}-compute@developer.gserviceaccount.com"
    scopes = [
      "https://www.googleapis.com/auth/compute",
      "https://www.googleapis.com/auth/servicecontrol",
      "https://www.googleapis.com/auth/service.management.readonly",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/devstorage.read_only",
    ]
  }

  resource_policies = [
    "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/resourcePolicies/monthly-k8s-runners"
  ]
}
# terraform import google_compute_instance.airqo_k8s_worker_4 projects/${var.project_id}/zones/${var.zone}/instances/airqo-k8s-worker-4
