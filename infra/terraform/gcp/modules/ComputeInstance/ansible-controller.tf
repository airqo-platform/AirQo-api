resource "google_compute_instance" "ansible_controller" {
  boot_disk {
    auto_delete = false
    source      = "https://www.googleapis.com/compute/v1/projects/${var.project_id}/zones/${var.zone["b"]}/disks/ansible-controller"
  }

  labels = {
    "env" = "prod"
  }

  machine_type = "e2-small"
  
  allow_stopping_for_update = true

  metadata = {
    startup-script = "sudo ufw allow ssh"
  }

  name = "ansible-controller"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network    = "default"
    network_ip = "10.132.0.44"
  }

  project = var.project_id

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "${var.project_number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  zone = var.zone["b"]
}
# terraform import google_compute_instance.ansible_controller projects/${var.project_id}/zones/${var.zone["b"]}/instances/ansible-controller