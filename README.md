# Contactly — AWS Learning Plan

**Contactly** is a simple contacts app (CRUD + email auth) built as a deliberate first step into the AWS serverless ecosystem.

The goal is to internalize the "AWS way" of building things — infra-as-code, managed auth, serverless compute, cloud-native databases — before tackling more complex projects. Every decision in this project prioritizes learning the core AWS mental model over feature completeness: one resource at a time, deployed and understood before moving to the next.

---

## The Stack

| Layer | Choice | Role |
|---|---|---|
| Infra | CDK (TypeScript) | Defines every resource as code, `cdk deploy` / `cdk destroy` |
| Frontend | React + TanStack | The UI, built to static files |
| Hosting | S3 + CloudFront | Serves the React build, single entry point |
| API | API Gateway (HTTP API) | HTTP routes, validates Cognito JWTs natively |
| Auth | Cognito | Email sign-up/sign-in, issues JWTs |
| Compute | Lambda (Node.js) | CRUD business logic, scoped per user |
| Database | DynamoDB (on-demand) | Stores contacts, pay-per-request, scales to zero at idle, pure IAM access |

---

## Architecture

![Contactly Architecture](docs/assets/architecture.png)

### Key architectural decisions

**DynamoDB as the data store**
Fully serverless and fully managed: access is a plain AWS SDK call authorized by IAM. The design discipline is access-pattern-first — list the queries the app makes, then shape the keys so each is answered by a single request. Contactly's patterns are simple (list a user's contacts, get/update/delete one), so a single table fits cleanly.

**One Contacts table, Cognito `sub` as the partition key**
Every contact lives under `PK = USER#<sub>`, so listing a user's contacts is one query against their partition and user isolation is structural — there's no `WHERE user_id =` to forget. No separate users table: Cognito is the user store (the JWT already carries `sub`, `email`). Full single-table design (multiple entity types sharing one table) would be overkill for a single relationship, so it's intentionally out of scope here.

**HTTP API (API Gateway v2) over REST API (v1)**
HTTP API has a native JWT authorizer — API Gateway validates Cognito tokens automatically with zero custom code. Cheaper and simpler than a Lambda authorizer.

**CDK (TypeScript) over SAM / console**
Infra as real code — loops, functions, shared types with Lambda handlers. One `cdk deploy` to create everything, one `cdk destroy` to tear it down cleanly. `RemovalPolicy.DESTROY` on all resources for clean teardown.

---

## Project Structure

```
contactly/
  infra/
    bin/
      app.ts               # CDK entry point
    lib/
      contactly-stack.ts   # All AWS resources defined here
    cdk.json
    tsconfig.json

  packages/
    api/
      src/
        handlers/
          contacts.ts      # CRUD Lambda handler
        db/
          client.ts        # DynamoDB DocumentClient helper
        types/
          index.ts         # Shared types

    web/
      src/                 # React + TanStack app

  package.json             # Monorepo root
  tsconfig.json
```

---

## Build Phases

The project is built in independently deployable phases, from an empty CDK stack to a full React frontend. See **[docs/BUILD_PHASES.md](docs/BUILD_PHASES.md)** for the phase-by-phase plan and progress tracking.

---

## Engineering Principles

- **Infra-as-code only** — no resources created manually in the console
- **Least-privilege IAM** — every Lambda gets only the permissions it needs, scoped to specific ARNs (here: `dynamodb:*` on the Contacts table ARN, nothing wider)
- **No long-lived credentials** — services authenticate via IAM roles, never plaintext secrets or env-var credentials (DynamoDB needs none)
- **`RemovalPolicy.DESTROY` on all resources** — `cdk destroy` must work cleanly every time
- **One phase at a time** — deploy and validate before adding the next layer
- **Read CloudWatch logs** — every time something breaks, logs first
