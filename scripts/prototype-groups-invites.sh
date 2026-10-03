#!/usr/bin/env bash
# PROTOTYPE (prototype/groups): seeds three invites into the local flexi-day database after
# `npm run dev:scenario`, so the join screen has real previews. Wiped by `npm run dev:reset`.
# Open one with: xcrun simctl openurl booted "flexiday://join?token=<secret>"
#   proto-alice-support-0000000000000000   open invite to Dev Support for alice@dev.local, from Dave Horak
#   proto-new-hire-000000000000000000000   open invite to Dev Team for a new address, from Olivia Owner
#   proto-expired-0000000000000000000000   expired invite to Dev Team
# It also gives Dev Team a holiday country, takes view access from carol@dev.local (the member
# without view access) and makes Dave Horak an untracked manager of Dev Support.
set -euo pipefail

DB="${DATABASE:-postgresql://localhost:5432/flexi-day}"
hash() { printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; }

psql "$DB" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM invite_link WHERE id LIKE 'proto-%';
UPDATE groups SET holiday_country = 'CZ', updated_at = now() WHERE group_name = 'Dev Team';
UPDATE group_users SET view_access = false, updated_at = now()
WHERE user_id = (SELECT id FROM "user" WHERE email = 'carol@dev.local');
UPDATE group_users SET controlled_user = false, updated_at = now()
WHERE user_id = (SELECT id FROM "user" WHERE email = 'dave@dev.local');
INSERT INTO invite_link (id, group_id, code, email, link_secret_hash, invited_by_user_id, expires_at)
SELECT 'proto-alice-support', g.id, 'PRT1-ALCE-SUPP', 'alice@dev.local', '$(hash proto-alice-support-0000000000000000)',
       g.manager_user_id, now() + interval '14 days'
FROM groups g WHERE g.group_name = 'Dev Support';
INSERT INTO invite_link (id, group_id, code, email, link_secret_hash, invited_by_user_id, expires_at)
SELECT 'proto-new-hire', g.id, 'PRT2-NEWH-TEAM', 'nina.marek@dev.local', '$(hash proto-new-hire-000000000000000000000)',
       g.manager_user_id, now() + interval '14 days'
FROM groups g WHERE g.group_name = 'Dev Team';
INSERT INTO invite_link (id, group_id, code, email, link_secret_hash, invited_by_user_id, expires_at)
SELECT 'proto-expired', g.id, 'PRT3-EXPD-TEAM', 'bob@dev.local', '$(hash proto-expired-0000000000000000000000)',
       g.manager_user_id, now() - interval '2 days'
FROM groups g WHERE g.group_name = 'Dev Team';
SQL
