resource "google_compute_instance" "mongos_router_0" {
  boot_disk {
    auto_delete = false
    source      = "mongos-router-0"
  }

  labels = {
    "env"  = "prod"
  }

  machine_type = "e2-medium"

  metadata = {
    startup-script = "sudo ufw allow ssh"
  }

  name = "mongos-router-0"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network    = "default"
    network_ip = "10.132.0.54"
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
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  tags = ["http-server", "https-server"]
  zone = var.zone["b"]
}
# terraform import google_compute_instance.mongos_router_0 projects/${var.project_id}/zones/${var.zone["b"]}/instances/mongos-router-0
