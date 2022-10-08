resource "google_compute_instance" "airqo_k8s_controller" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "ubuntu-1804-bionic-v20200916"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/zones/europe-west1-b/disks/airqo-k8s-controller"
  }

  can_ip_forward = true
  machine_type   = "custom-2-4096"

  name = "airqo-k8s-controller"

  network_interface {
    access_config {
      nat_ip       = "34.78.78.202"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.11"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = var.project-id
  }

  project = var.project-id

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "${var.project-number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s", "controller"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_k8s_controller projects/${var.project-id}/zones/europe-west1-b/instances/airqo-k8s-controller
