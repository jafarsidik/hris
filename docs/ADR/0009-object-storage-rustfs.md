# ADR 0009: RustFS as the object storage provider

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

The platform needs object storage for employee documents, resumes, receipts, payslips,
HR letters and case evidence (`docs/ARCHITECTURE.md` §15). This is regulated,
personally identifying data, so the provider decision is a long-lived commitment rather
than a local preference.

The realistic self-hosted candidates are MinIO and RustFS, both of which expose the
Amazon S3 API.

MinIO was the default answer for years, but its position changed materially:

- The repository is archived and the vendor has moved development to a commercial
  product. The last community release predates any ongoing upstream security
  maintenance.
- The licence is AGPL-3.0. For a proprietary commercial HRIS product this is a material
  legal exposure, not a formality.

RustFS is Apache-2.0, actively developed, and positions itself as a drop-in MinIO
replacement. Its weakness is maturity: the first generally available release is recent,
and some S3 features are documented upstream as still under test.

## Decision

**Use RustFS as the development and self-hosted object store, reached over its
S3-compatible API, with no application code aware of the provider.**

1. Configuration uses provider-neutral names: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`,
   `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`. Changing provider is a change of
   endpoint.
2. Access goes through the S3 API only. No RustFS-specific interface is permitted.
3. The development bucket is created with versioning enabled, via a one-shot
   `rustfs-init` service. Object Lock is deliberately **not** enabled yet.
4. Both published ports are bound to `127.0.0.1`, not to every interface.
5. Storage credentials are required, never defaulted.

## Rationale

**Licensing decided it.** AGPL-3.0 in a proprietary product is the kind of dependency
that surfaces at the worst possible moment. Apache-2.0 removes the question entirely.

**An archived object store is a security problem, not just a maintenance one.** The
system this storage backs holds payslips and case evidence. Depending on software that
receives no upstream security releases means a storage-layer vulnerability has no fix
path. That risk outweighs RustFS's shorter track record.

**The maturity gap is contained by not depending on the provider.** Because everything
goes through S3, the downside case is bounded: if RustFS turns out to lack an operation
we need, or a serious defect appears, we repoint `STORAGE_ENDPOINT` at MinIO, Ceph or
AWS S3 and nothing else changes. The expensive part of that swap is credentials and
data migration, not code.

**Versioning on, Object Lock off.** Payslip and evidence immutability ultimately wants
write-once retention. Object Lock can only be applied when a bucket is created, so
enabling it prematurely is close to irreversible: if the setting turns out to be wrong,
the remedy is a new bucket and a data migration. Versioning gives recoverable
overwrites today at no cost, and Object Lock is deferred until its RustFS support has
been verified against real operations rather than read off a feature matrix.

**Loopback binding.** Port 9000 serves the S3 API *and* an admin API, and port 9001
serves a browsable web console. Publishing either on all interfaces would expose
document storage to the local network. Containers are unaffected, because they reach
the service by name over the private compose network.

**Required credentials.** RustFS falls back to `rustfsadmin`/`rustfsadmin` when no
credentials are supplied. That is acceptable for a throwaway sandbox and unacceptable
elsewhere, so the compose file treats these variables as required (`${VAR:?…}`) rather
than defaulting them.

## Consequences

**Accepted costs**

- RustFS is younger than MinIO was. Before any production deployment, the operations
  the file-management phase depends on — pre-signed URLs, multipart upload, streaming,
  content-type handling — must be verified against it, not assumed from the marketing
  material.
- Object-level immutability is weaker than the architecture intends. Until Object Lock is
  validated and enabled, immutability rests on application logic and database audit,
  not on the storage layer.
- The `rustfs-init` service is a one-shot job with no healthcheck, so the standard
  "wait for healthy" gate says nothing about whether bucket provisioning succeeded.
  CI asserts its exit code explicitly for this reason.
- The image runs as uid 10001 and cannot create `/var/log/rustfs/` inside its own
  filesystem. Logging is therefore left on stdout. Using a bind mount instead of the
  named volume `rustfs-data` would additionally require the `chown` init container the
  upstream docs prescribe.

**Operational notes**

- The access key must be uppercase alphanumeric. AWS Signature Version 4 embeds it in
  the credential scope, and characters such as `/` break signature calculation. This is
  why `.env.example` uses `HRISDEVACCESSKEY` rather than a value from `openssl rand`.
- Readiness, not liveness, is the correct healthcheck target: `/health/ready` returns
  200 only once storage and IAM are usable, so nothing starts against a half-initialised
  store.
- `rc` is the client (`rustfs/rc`). Bucket creation is idempotent via
  `--ignore-existing`, which is what allows it to run on every `up`.
- Pin the image tag before production. `:latest` is acceptable for local development
  and is a supply-chain risk in any shared environment.

## Notes for maintainers

Do not add RustFS-specific configuration to application code. If something cannot be
expressed through the S3 API, the correct response is to reconsider the requirement, not
to reach for a vendor extension — that is what would make the provider swap in this ADR
impossible.

Never commit storage credentials. Production values come from a secret manager.