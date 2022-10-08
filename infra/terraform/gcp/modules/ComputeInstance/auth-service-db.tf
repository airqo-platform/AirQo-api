resource "google_compute_instance" "auth_service_db" {
  boot_disk {
    auto_delete = true
    device_name = "auth-service-db"

    initialize_params {
      image = "ubuntu-1804-bionic-v20210504"
      size  = 100
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/zones/europe-west1-b/disks/auth-service-db"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-small"

  name = "auth-service-db"

  network_interface {
    access_config {
      nat_ip       = "35.240.84.68"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.7"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = var.project-id
  }

  project = var.project-id

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "${var.project-number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["db-vm", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.auth_service_db projects/${var.project-id}/zones/europe-west1-b/instances/auth-service-db
