Find the default setup guide in the ArgoCD [Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/#getting-started) docs

### Custom setup guide

#### Installation

Run the commands below to create the necessary resources.

```
kubectl create namespace cicd
kubectl create -n cicd -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.5.4/manifests/install.yaml
```

ArgoCD is by default installed in a namesapce called `argocd`. This means that all resources are assumed to be in that namespace including all the service accounts. We however install ours in the `cicd` namespace and thus the cluster role bindings [argocd-application-controller](https://github.com/argoproj/argo-cd/blob/9353328eb8ae7357538146269d41aa692d99c4cf/manifests/install.yaml#L9673) and [argocd-server](https://github.com/argoproj/argo-cd/blob/9353328eb8ae7357538146269d41aa692d99c4cf/manifests/install.yaml#L9690) configurations need to be updated to reference the respective service accounts in the `cicd` namespace. Therefore, you need to take care of this change by creating the [required clusterrolebingings](./cluster-role-bindings.yaml) in the `cicd` namespace

```
kubectl create -f k8s/argo-cd/cluster-role-bindings.yaml
```

#### Accessing Argo CD API Server

By default, ArgoCD API Server is meant to be accessed at the root path(i.e hostname.com/). We however already have an [the platform](https://platform.airqo.net/) running at our root path and so, we set the **/argocd** as the rootpath for the ArgoCD API server.However for this configuration to work, we set the [UI Base Path](https://argo-cd.readthedocs.io/en/stable/operator-manual/ingress/#ui-base-path) and [ArgoCD Server and UI Root Path](https://argo-cd.readthedocs.io/en/stable/operator-manual/ingress/#argocd-server-and-ui-root-path-v153) as specified in the respective documentations. Therefore, for it all to work fine, update the ArgoCD server deployment with the [new ArgoCD server configuration](./argocd-server-deployment.yaml).

```
kubectl patch -n cicd deployment argocd-server --patch-file=k8s/argo-cd/argocd-server-deployment.yaml
```

Checkout the argocd virtaul server route in [this file](../nginx/production/virtual-server.yaml) for the nginx rewrite configuration.

Also, according to the ArgoCD [Ingress Configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/ingress/#ingress-configuration),

> The API server should be run with TLS disabled. Edit the argocd-server deployment to add the --insecure flag to the argocd-server command, or simply set server.insecure: "true" in the argocd-cmd-params-cm

Therefore, update the argocd-cmd-params-cm configmap with the command below.

```
kubectl patch -n cicd configmap argocd-cmd-params-cm --patch-file=k8s/argo-cd/argocd-cmd-params-cm.yaml
```

### Using the CLI

By default, there will be an admin account and to get it's initial password, run the command below;

```
kubectl -n cicd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

Use the password to login with the following command

```
argocd login platform.airqo.net --username admin --password  enterInitialPasswordHere --skip-test-tls --grpc-web --grpc-web-root-path=/argocd
```

You should update the password of the admin user as soon as possible

```
argocd account update-password --account admin --current-password enterInitialPasswordHere --new-password enterNewPasswordHere --grpc-web --grpc-web-root-path=/argocd
```

You can use this command to update any user's password with `--current-password` value being the admin user password.

To understand the meanings of the flags used above among others, checkout the ArgoCD [Command Reference](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd/)

#### User management

To learn about user account management in ArgoCD, checkout their [user management docs](https://argo-cd.readthedocs.io/en/stable/operator-manual/user-management/#dex)

As you can see our [argocd-cm](./argocd-cm.yaml), we disabled the admin account have and a guest account added. We also have a Dex configuration to use with GitHub and to know more about it, checkout [Dex's GitHub connector](https://github.com/dexidp/website/blob/main/content/docs/connectors/github.md).

**Fill in the clientID and clientSecret values** under the `dex.config` and run the command below to update the argocd-cm configmap;

```
kubectl patch -n cicd configmap argocd-cm --patch-file=k8s/argo-cd/argocd-cm.yaml
```

#### RBAC Configuration

To learn about RBAC Configuration in ArgoCD, checkout their [respective documentation](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
In [our RBAC configuration](./argocd-rbac-cm.yaml), members of the devops team are the ArgoCD admin, those of the engineering team viewers, while the guest user is only permitted to view the repositories. By default, all new users have no permissions(role:'')

Run the command below to update the RBAC with these rules;

```
kubectl patch -n cicd configmap argocd-rbac-cm --patch-file=k8s/argo-cd/argocd-rbac-cm.yaml
```
