resource "google_compute_instance" "mlflow_tracking_server" {
  boot_disk {
    auto_delete = true
    device_name = "mlflow-tracking-server"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/cos-cloud/global/images/cos-77-12371-1109-0"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/us-central1-a/disks/mlflow-tracking-server"
  }

  machine_type = "e2-small"

  metadata = {
    startup-script-url = "gs://airqo-mlflow-artifacts/scripts/start_mlflow_tracking.sh"
    ssh-keys           = "daniel:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBFtoThtOpgKW12Udul1RVg3RGb3p0Xpv9D3dKUNTZQMUQbxLQ25yL0heetkrnWEzkTI8aALfN+Oavj0pdfe2Nxk= google-ssh {\"userName\":\"daniel@airqo.net\",\"expireOn\":\"2022-05-25T02:54:16+0000\"}\ndaniel:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCG7lsVaxwYAzv5iaf56kWro3q7XjaPQRih2b0poYUuKu2HIluNEfAOGeX8/Bi5+3dIlBcTJGyIwpWU45Z22vhDw73VClPGl/0wVzZ5WXwiyfUl9iKzPOYkbIRIrytQx3+mHXwsmNRqX/mqFoYhXD8hCn2omvsUT+UXMAEjG8FBxYe5XvNjRqc1lkbkygtaZp0rgbeHkNzuyOE/Ert2XSon55pjA0WZWHS3yP69VDS/yR/2Rw2Ktx0wCIfIYg7rrcErKYm3DUiaIyntFHLhJ4to5bFqXrLpzanUJ3jj84ukP4XjRlPCV/CpaMad4cWQXGtYAwIzuttBFCWo8ebphrX3 google-ssh {\"userName\":\"daniel@airqo.net\",\"expireOn\":\"2022-05-25T02:54:35+0000\"}"
  }

  name = "mlflow-tracking-server"

  network_interface {
    access_config {
      nat_ip       = "23.251.144.212"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
    network_ip         = "10.128.0.22"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/us-central1/subnetworks/default"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "mlflow-tracking-sa@airqo-250220.iam.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["mlflow-tracking-server"]
  zone = "us-central1-a"
}
# terraform import google_compute_instance.mlflow_tracking_server projects/airqo-250220/zones/us-central1-a/instances/mlflow-tracking-server
