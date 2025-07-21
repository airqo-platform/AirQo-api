variable "project_id" {
  default     = "airqo-250220"
  description = "GCP project ID"
}

variable "project_number" {
  default     = "702081712633"
  description = "GCP project number"
}

variable "region" {
  default     = "europe-west1"
  description = "Default region"
}

variable "zone" {
  default     = {
    "b"  = "europe-west1-b"
    "c"  = "europe-west1-c"
    "d"  = "europe-west1-d"
  }
  description = "Available zones in the default project region (europe-west1)"
}

variable "os" {
  default = {
    "ubuntu-focal"  = "ubuntu-2004-focal-v20220712"
    "ubuntu-jammy"  = "ubuntu-2204-jammy-v20230425"
  }
  description = "Operating systems to use"
}

variable "disk_size" {
  default = {
    "tiny"   = "10"
    "small"  = "20"
    "medium" = "50"
    "large"  = "100"
    "huge"   = "200"
  }
  description = "Disk sizes to use"
}
