# Deploying the API

The web app deploys by itself to GitHub Pages (`.github/workflows/deploy.yml`). The API runs in Docker on the
AWS app server (`parakh-production-app`, shared with Parakh) and is deployed by `.github/workflows/deploy-api.yml`.

## What happens on a merge

1. A push to `main` that changes `api/**` (or the workflow itself) starts **Deploy API**. You can also start it
   by hand from the Actions tab (it must run on `main`).
2. The job signs in to AWS with GitHub OIDC (no stored keys) as the role `nandivex-api-github-deploy`.
3. It asks the server, through Systems Manager, to run the document `nandivex-api-deploy` with the commit SHA.
4. On the server the document: tags the running image as `nandivex-api:prev`, fast-forwards `/opt/nandivex/src` to
   the commit, builds the image, restarts the container, and waits for `http://127.0.0.1:4010/health`.
   If the build or the health check fails it puts `nandivex-api:prev` back and exits with an error, so the job
   goes red and the old version keeps serving.
5. The job prints the server output and finally checks `https://api.nandivex.in/health`.

If the server is already at or past the commit, the document says "Already deployed" and does nothing.
Only API changes deploy the API. Database migrations are **not** run: the container does not run `prisma migrate`,
so a change under `api/prisma/migrations` has to be applied by hand before or after the deploy.

## What exists in AWS (account 143920986615, region ap-south-1)

| Thing | Name |
|---|---|
| SSM command document | `nandivex-api-deploy` (a copy of it is `deploy/nandivex-api-deploy.ssm.json`) |
| IAM role for GitHub | `nandivex-api-github-deploy` |
| OIDC provider | `token.actions.githubusercontent.com` (already used by other projects) |

The role can be assumed only by this repository's `main` branch. Its only rights are `ssm:SendCommand` on that one
document and that one instance, and reading command results. It cannot run any other command on the server.

## Changing the deploy steps

Edit `deploy/nandivex-api-deploy.ssm.json`, then update the document in AWS (the repo copy is not applied by itself):

```bash
aws ssm update-document --name nandivex-api-deploy --document-version '$LATEST' \
  --document-format JSON --content file://deploy/nandivex-api-deploy.ssm.json
aws ssm update-document-default-version --name nandivex-api-deploy --document-version <new version>
```

## Rolling back by hand

On the server (`/opt/nandivex`): `docker tag nandivex-api:prev nandivex-api:local && docker compose up -d`.
