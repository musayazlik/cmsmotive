# Store users and domain switching

Accounts are shared identities. `StoreMember` assigns each account an `admin` or `user` role per store. The installation `superadmin` can administer every store. A global `User.role = admin` no longer grants access without a store membership.

The migration preserves existing administrators' prior access by creating admin memberships for all existing stores. Earlier ordinary registrations are associated with the default store and any stores identified by their customer records. New registrations join only the store where they sign up.

The panel store selector lists only the signed-in account's stores. A switch uses a one-minute Better Auth one-time token, bound to the authenticated session, target store, target origin and source origin. The browser submits it in a POST body to the target domain. The target rechecks the session and membership, consumes the token once, and sets a host-only cookie through Better Auth. It redirects administrators to the configured panel entry and ordinary members to `/account`. Cookies are not shared across unrelated domains, and reusable session tokens never appear in navigation URLs. Public Better Auth one-time-token endpoints are blocked; only the bound handoff can redeem a code.

Keep the private panel's `Referrer-Policy: strict-origin`: it hides private paths and allows the browser's cross-origin POST to identify its source origin. `no-referrer` makes that Origin `null`, which the handoff correctly rejects.

The Users screen and MCP user tools manage the current store's memberships. Adding an existing e-mail preserves its identity and credentials. Removing membership keeps the account and other memberships. A store administrator cannot change a shared account's name, e-mail or password unless editing their own account; the installation superadmin can do so. Installation-wide backup and private-entry settings are restricted to the superadmin.

Run `pnpm test:store-access` for isolated database coverage of permissions, membership management, token expiry, replay, origin/target binding, revocation, concurrent redemption and administrator/customer destinations.
