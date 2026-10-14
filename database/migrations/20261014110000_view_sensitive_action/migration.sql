-- Adds the `view_sensitive` action to the RBAC vocabulary (Phase 3).
--
-- A registered resource field may be marked `is_sensitive` (for example a password hash
-- on the `user` resource). Reading such a record redacts the field unless the caller
-- holds `view_sensitive` on that resource — a `manage` grant also implies it.
--
-- PostgreSQL allows adding an enum value inside a transaction as long as the new value
-- is not referenced in the same transaction, which is the case here.

ALTER TYPE "Action" ADD VALUE IF NOT EXISTS 'view_sensitive';
