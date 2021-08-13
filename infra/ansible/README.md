## 1. Directory Layout

This is the directory layout of this repository with explanation.

    production.ini            # inventory file for production stage
    development.ini           # inventory file for development stage
    test.ini                  # inventory file for test stage
    vpass                     # ansible-vault password file
                              # This file should not be committed into the repository
                              # therefore file is in ignored by git
    group_vars/
        all/                  # variables under this directory belongs all the groups
            apt.yml           # ansible-apt role variable file for all groups
        webservers/           # here we assign variables to webservers groups
            apt.yml           # Each file will correspond to a role i.e. apt.yml
            nginx.yml         # ""
        postgresql/           # here we assign variables to postgresql groups
            postgresql.yml    # Each file will correspond to a role i.e. postgresql
            postgresql-password.yml   # Encrypted password file
    plays/
        ansible.cfg           # Ansible.cfg file that holds all ansible config
        webservers.yml        # playbook for webserver tier
        postgresql.yml        # playbook for postgresql tier

    roles/
        roles_requirements.yml# All the information about the roles
        external/             # All the roles that are in git or ansible galaxy
                              # Roles that are in roles_requirements.yml file will be downloaded into this directory
        internal/             # All the roles that are not public

    extension/
        setup/                 # All the setup files for updating roles and ansible dependencies
