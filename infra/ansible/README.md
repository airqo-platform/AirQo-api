## 1. Directory Layout

This is the directory layout of this repository with explanation.

    playbooks/              # All playbooks go here
    setup/                  # Files here are added to the ansible control node
        etc/                # Files here go to the '/etc/ansible/' path
            roles/          # Directory for all roles
            ansible.cfg     # Ansible.cfg file that holds all ansible configurations
            hosts           # Static inventory file
        gcp.yaml            # This GCP dynamic inventory file goes to the '/opt/ansible/inventory/gcp.yaml' path
