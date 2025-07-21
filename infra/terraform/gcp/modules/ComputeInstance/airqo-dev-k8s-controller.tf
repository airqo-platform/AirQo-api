resource "google_compute_instance" "airqo_dev_k8s_controller" {
  name    = "airqo-dev-k8s-controller"
  project = var.project_id
  zone    = var.zone["b"]

  machine_type = "e2-standard-2"
  
  allow_stopping_for_update = true

  boot_disk {
    auto_delete = false
    source      = "https://www.googleapis.com/compute/v1/projects/${var.project_id}/zones/${var.zone["b"]}/disks/airqo-dev-k8s-controller"
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
    network_ip = "10.240.0.23"
  }
  tags = ["airqo-k8s", "controller"]

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
    "https://www.googleapis.com/compute/v1/projects/${var.project_id}/regions/${var.region}/resourcePolicies/daily-dev-vms"
  ]
}
# terraform import google_compute_instance.airqo_dev_k8s_controller projects/${var.project_id}/zones/${var.zone["b"]}/instances/airqo-dev-k8s-controller
