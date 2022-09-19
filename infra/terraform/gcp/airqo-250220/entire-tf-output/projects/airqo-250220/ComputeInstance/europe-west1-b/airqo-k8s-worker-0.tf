resource "google_compute_instance" "airqo_k8s_worker_0" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20200916"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-k8s-worker-0"
  }

  can_ip_forward = true
  machine_type   = "custom-2-15360-ext"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNc9uFlDMFeIXso0ey8jOiHmJwYZhMUcUSKseO4yOgkt3F1OHCQq+U0fTcyDx995nPXMvfxMJOKf70rq4dWJMBA= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-20T07:32:38+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAGy+OwQ1yyZa6RN2I8hBBUl0z++Q7DMqYYWA0vkW9ZqYxRo/SEpfhy4xKPgmrMRfBZrKM4fj9QGxPsyafmGxqf0+/8otO9/QRE8fY3oFfbKklBId9ASq/6XIFAECZB42XFwDhToF/Ih5LTaJyAK7MFBv14mxVjNaFQl23gs7j7vq4EAqFDLYd3ahu4sishb1RwSxvdaa+jvuv5JvY/gG2u6/WfgOK7cTFoF7bsrh2AXLtWS1ZtwytTEyDe6J/bVBDk0CpArc4r9S+W418HAhVmdBZLOgC7XMz3GTDItm8Ljj0vvvoxE/cQkSYy2GDu5UVDQrBxgkUIu14/7oN/HJw4s= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-20T07:32:54+0000\"}"
  }

  name = "airqo-k8s-worker-0"

  network_interface {
    access_config {
      nat_ip       = "34.79.29.10"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.20"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s", "worker"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_k8s_worker_0 projects/airqo-250220/zones/europe-west1-b/instances/airqo-k8s-worker-0
