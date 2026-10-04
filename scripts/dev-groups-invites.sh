#!/usr/bin/env bash
# Local test data for Groups, run after `npm run dev:reset` and `npm run dev:scenario` from the
# workspace root, and nina.marek@dev.local seeded with no team (the flexi-dev MCP server's
# dev_seed_user without teamName; `dev:seed` always adds one). `dev:reset` wipes it again.
#
# Seeds three invites. Open a link with
#   xcrun simctl openurl booted "flexiday://join?token=<secret>"
#   dev-alice-support-00000000000000000   code 3VHN-8QWD-K2ZR  open, Dev Support, alice@dev.local
#   dev-new-hire-00000000000000000000000  code 6TBX-R4MJ-9CPG  open, Dev Team, nina.marek@dev.local
#   dev-expired-000000000000000000000000  code 5GKW-2NHT-8YDF  expired, Dev Team, bob@dev.local
# It also gives Dev Team the holiday country CZ, takes view access from carol@dev.local and makes
# dave@dev.local untracked.
set -euo pipefail

DB="${DATABASE:-postgresql://localhost:5432/flexi-day}"
hash() { printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; }

psql "$DB" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM invite_link WHERE id LIKE 'dev-invite-%';
UPDATE groups SET holiday_country = 'CZ', updated_at = now() WHERE group_name = 'Dev Team'
  AND manager_user_id = (SELECT id FROM "user" WHERE email = 'owner@dev.local');
UPDATE group_users SET view_access = false, updated_at = now()
WHERE user_id = (SELECT id FROM "user" WHERE email = 'carol@dev.local');
UPDATE group_users SET controlled_user = false, updated_at = now()
WHERE user_id = (SELECT id FROM "user" WHERE email = 'dave@dev.local');
INSERT INTO invite_link (id, group_id, code, email, link_secret_hash, invited_by_user_id, expires_at)
SELECT 'dev-invite-alice-support', g.id, '3VHN-8QWD-K2ZR', 'alice@dev.local',
       '$(hash dev-alice-support-00000000000000000)', g.manager_user_id, now() + interval '14 days'
FROM groups g WHERE g.group_name = 'Dev Support';
INSERT INTO invite_link (id, group_id, code, email, link_secret_hash, invited_by_user_id, expires_at)
SELECT 'dev-invite-new-hire', g.id, '6TBX-R4MJ-9CPG', 'nina.marek@dev.local',
       '$(hash dev-new-hire-00000000000000000000000)', g.manager_user_id, now() + interval '14 days'
FROM groups g WHERE g.group_name = 'Dev Team'
  AND g.manager_user_id = (SELECT id FROM "user" WHERE email = 'owner@dev.local');
INSERT INTO invite_link (id, group_id, code, email, link_secret_hash, invited_by_user_id, expires_at)
SELECT 'dev-invite-expired', g.id, '5GKW-2NHT-8YDF', 'bob@dev.local',
       '$(hash dev-expired-000000000000000000000000)', g.manager_user_id, now() - interval '2 days'
FROM groups g WHERE g.group_name = 'Dev Team'
  AND g.manager_user_id = (SELECT id FROM "user" WHERE email = 'owner@dev.local');
SQL
