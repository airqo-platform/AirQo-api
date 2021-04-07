## Terraform
Terraform is an open-source infrastructure as code software tool that enables you to safely and predictably create, change, and improve infrastructure.
### Terraform at AirQo
At AirQo, we utilize terraform to quickly build and configure a reproducible cloud infrasturcture that spans multiple cloud providers. Using the concepts of `infrastructure as code (Iac)`, we are able to reconstruct the entire AirQo cloud infrasturcture in no time.

### Directory Structure
```
aws
│
└───assets
│   │
└───staging 
│   │
└───production
│   │
│   
gcp
│
└───assets
│   │
└───staging 
│   │
└───production
│   │
│_______  
```
### Installation and Usage 
Download and install terraform from [HERE](https://www.terraform.io/downloads.html)
Check out the repo `cd AirQo-api/infra/terraform/gcp/staging` for GCP. Same procedure for AWS in the respective directory.

*You need to have a GCP `service account key` with the necessary privilege stored in the `assets` directory named `airqo-terraform.json`*

Run the following commands:
```
terraform init
terraform plan
terraform apply
```
What is done in the background; 
- Configuration of VPC network
- Configuration IP addressing
- Configuration firewall rules for various AirQo services. E.g mongodb, k8s nodeport, http, icmp, ssh, etc
- Create instances and configure boot_disk setting (image selection, disk size, etc)
- Installation and configuration of HAproxy, API gateway and Loadbalancing 
- Installation and configuration of SSL/TLS termination using [Let's Encrypt](https://letsencrypt.org/)
- Etc.

### Clean Up
If you wish to delete a test setup/infrasturcture, simply run the command below:
```
terraform destroy
```

