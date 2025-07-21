variable "project_id" { type = string }
variable "project_number" { type = string }
variable "region" { type = string }
variable "zone" { type = map(any) }
variable "os" { type = map(any) }
variable "disk_size" { type = map(any) }