---
name: vault-k8s-auth
description: >
  Wire Vault Kubernetes authentication for a service using hvac. Use this skill
  when adding or modifying Vault auth in any Kubernetes-deployed service — always
  read the Vault role and mount path from environment variables, never hardcode
  them.
license: BSD-3-Clause
metadata:
  category: infrastructure
---

# Vault Kubernetes Auth

Services on Kubernetes authenticate to Vault using the Kubernetes auth method
via the `hvac` library. This applies to any Python service the team deploys on
the cluster — not just Dagster.

## Environment variables

**Never hardcode the Vault role or mount path.** Always read them from environment
variables:

| Variable | Purpose |
|----------|---------|
| `VAULT_ADDR` | URL of the Vault server |
| `VAULT_ROLE` | Vault role bound to the pod's Kubernetes service account |
| `VAULT_K8S_MOUNT` | Vault Kubernetes auth mount path |

Example wiring:

```python
import os
import hvac

vault_role = os.environ["VAULT_ROLE"]
vault_mount = os.environ["VAULT_K8S_MOUNT"]

client = hvac.Client(url=os.environ["VAULT_ADDR"])
client.auth.kubernetes.login(
    role=vault_role,
    jwt=_read_service_account_token(),
    mount_point=vault_mount,
)
```

## Kubernetes RBAC / auth binding

Use the `OLEKSAuthBinding` component to bind the pod's Kubernetes service account
to the Vault role. This component handles the Vault policy and role configuration.

## Helm / pod spec

Inject the variables via Helm values for each service's deployment:

```yaml
env:
  - name: VAULT_ROLE
    value: "<service-name>-role"
  - name: VAULT_K8S_MOUNT
    value: "<mount-path>"
  - name: VAULT_ADDR
    valueFrom:
      secretKeyRef:
        name: vault-config
        key: addr
```
