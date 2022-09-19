resource "google_compute_instance" "airqo_k8s_worker_2" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-k8s-worker-2"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220712"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-k8s-worker-2"
  }

  can_ip_forward = true

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "c2-standard-4"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEwuFpNtCv++8AbQHVADj8Z/ly9ZJsqLwx1YfnccHkavs55jdutq0Jd2iCcqXIszucjioR273DERmfsftPxpBL4= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-21T09:54:18+0000\"}\nmikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNIrl8KF9QlvwZggm2ajxle4YKslDjxTYlUMyCjyufw+ERrycmDlmdzreBODYz0z3pKyXQ9A8Ihgr9HMdLnKlM4= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-21T09:54:26+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAG5kONi4I10cjoieCkVTM1a0U3vtNW+bmhDAhdxaArggu04MqYFANfoe8Zyt0Cn7GAR6fw5nLHoTUW0HQz/DUER9dePF7p6hiUZqvVU4CHb6P92nbe013LYXv/6lMFG4iy0HqsQlV3XNmHHSpwcGpmT55C7r0V3C7NaB3NbGri0wCp5u/XaAymtU1XTE/pkWrI1tZNoADkshgZavGBPA+M+qi4oczsWNZ8qOKEvyoDr3PMdPU2BZQGlh6Sg3aUYhb9aOvJYlfohmEqe/qOuXmlZn3rGl0WN/+2qtut3Iim2Kj6BEanxksCTVtatAop5DKFNJFPXBOskgAx0gcd3jt88= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-21T09:54:34+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAF39sxOC6fh+vesM4QbP+H0G3DZX9MSuq9z/vvBo/h83kQSbEY5c6h0n1V/NQMFibbFoJnctuRqT9jJfHTAZB+FQJvI4eWRkzrURlsAgXDRISuhZIFzaZL52jKYKuk9SkrMXdfysOqXvM2WADR9EhISfJm4dNy8FgnHGiLcCFQqjd1W1ljLtxQeC06oo1bzKtdE8lvGYEaIJE6dJezeyu7HdTKNilk2LAmrY5KHyMA/ZBZEWP/Hu8TMTPd8MLviD2W34T9QXMN2lZgZm7H+0Wy5igwsDq1GkQeMTfmUxUw4nNG9je6ZwqAbnTXFr54hhQDFblNZu2Ra+XAwxt8UGTzs= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-21T09:54:43+0000\"}"
  }

  name = "airqo-k8s-worker-2"

  network_interface {
    access_config {
      nat_ip       = "35.205.24.251"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.69"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
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
# terraform import google_compute_instance.airqo_k8s_worker_2 projects/airqo-250220/zones/europe-west1-b/instances/airqo-k8s-worker-2
