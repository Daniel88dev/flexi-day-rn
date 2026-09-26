# ADR 0003: Ask the backend what the viewer may do instead of deriving it from the local store

Date: 2026-09-26. Status: accepted.

## Context

The phone's screens serve approvers and admins as well as employees: approving and rejecting
requests, cancelling someone else's, and booking on a member's behalf with approve-immediately.
Each of those needs an answer to "may this viewer do this, here?".

The local store already holds most of the inputs. Every group the viewer belongs to arrives with
its manager and its main and temp approver, and the viewer's own `groupUsers` row carries
`approverAccess` and `adminAccess`. Deriving permissions from those rows would work offline and
cost no request. It would also be wrong in three places:

- Org-admin standing never reaches the phone. The sync pull carries no `organization_users` rows
  and no owner, yet an org admin may book, auto-approve and cancel on a member's behalf.
- An approver without view access syncs only their own rows in that group, so the requests they
  must decide are not in the store to decide.
- The backend's rules on deciding your own request (only `approverAccess` lifts it, and not while
  your records are mirrored in from another group) would be copied into a second codebase and
  drift.

Two other options were weighed. The sync pull could carry per-group verdicts computed on the
server. That keeps the rules in one place and works offline, but it needs a backend change and
still leaves the approver without view access with nothing to approve. The web answers the
question per screen from the backend, and writes on the phone are online-only already.

## Decision

The phone asks the backend what the viewer may do, per screen, the same way the web does.

- The approvals list comes from `GET /api/users/me/approvals`, which returns only what the viewer
  may decide.
- `canApprove`, `canCancel` and `canEdit` come from the request detail, fetched fresh on every
  open.
- Booking on someone's behalf is offered when the group detail returns `access.canAdmin`, org
  admins included, and only in groups the viewer belongs to.
- The phone never derives any of these from local rows. Action buttons appear only on items from
  `/me/approvals` or on a fetched detail.
- One local check is allowed, for display only: whether the viewer approves in some group
  (manager, main or temp approver, or `approverAccess`). It decides whether the dashboard shows
  the approvals widget and pending stat. It is exact, because org admins never approve.
- The shell carries no admin links until the manager-only pages exist on the phone.

## Consequences

- Every action screen needs connectivity to show its buttons, not just to submit. Offline, a
  request opens read-only from the local store.
- A role that changes while the app is open takes effect on the next read: screen focus, app
  foreground, or after the viewer's own write. The backend re-checks every write, so a stale screen
  costs one refused tap: the 403 or 409 shows the server's message, reloads the screen and starts a
  sync pull.
- The phone needs a query layer with keyed invalidation and refetch on focus.
- Using the `groupUsers` flags in the store to gate an action reopens this ADR.
