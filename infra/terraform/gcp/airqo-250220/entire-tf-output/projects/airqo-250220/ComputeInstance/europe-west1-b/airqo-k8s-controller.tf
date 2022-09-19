resource "google_compute_instance" "airqo_k8s_controller" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20200916"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-k8s-controller"
  }

  can_ip_forward = true
  machine_type   = "custom-2-4096"

  metadata = {
    ssh-keys = "noah:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBI+AsydW7ms9AI+QqJ0j2gjq0PzwwkOzriO4NCS2lfAw5b+XJA9EnEZk2yuiQLqYqEFnG1/UfAAWGh60+m8d96o= google-ssh {\"userName\":\"noah@airqo.net\",\"expireOn\":\"2022-08-03T08:54:23+0000\"}\nnoah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAGfgd5D5BhS6GsbLvEwBsO0t4yuTLJKsTudhS+dUCpFC9CNQ8b5+0dLbAhbKhM0EDkKEzACYdqkDiU+gW7YIT5ok5YTuIFbUjXpyq40yOhF3u1mRNcUQ5BBAwgxbeJYru4bbpl0MxiVfvph7fTwHXLVVlqGat93iWbXvCk3qqp4GrKvftnXlfnKUuRjPq7zjUXnHhacbvAzZejHhvBRYf6rHaFAJrORcXbvxhi7aDBSvnvr5UPybWeP6rouLhk1VKhvkEONB6Y75a8msL1uAtJEVyicA30y4WApM4/qs2giiKUzZ2c4b15xMYzASErm2rPF1u/Vtu9JnxaPo+Bfqp9M= google-ssh {\"userName\":\"noah@airqo.net\",\"expireOn\":\"2022-08-03T08:54:39+0000\"}"
  }

  name = "airqo-k8s-controller"

  network_interface {
    access_config {
      nat_ip       = "34.78.78.202"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.11"
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

  tags = ["airqo-k8s", "controller"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_k8s_controller projects/airqo-250220/zones/europe-west1-b/instances/airqo-k8s-controller
