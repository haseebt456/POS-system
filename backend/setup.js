const crypto = require('crypto');
const { runMigrations } = require('./migrate');
const { createUser, countActiveAdmins, getUserByUsername } = require('./models/user');

// runMigrations() applies schema.sql itself, so this is the whole of setup: create what's
// missing, add what has changed, fill in what is new. It is the same function server.js
// calls on every start, which is the point — a fresh install and a shop that has been
// running for months end up in exactly the same place, by the same code path.
const applied = runMigrations();

console.log(
    applied.length
        ? `Database ready. Applied: ${applied.join(', ')}`
        : 'Database ready. Already up to date.'
);

// Every /api route now requires a session, so a database with no usable admin is an
// application nobody can sign into — it starts, serves 401s, and offers no way in.
//
// This lives in setup.js and not in migrate.js on purpose. runMigrations() executes on
// every server start, and an install that already has an admin must never have another one
// quietly added behind the shop's back. Seeding is a setup step, not a schema change.
//
// The guard asks "is there an active admin", not "is the users table empty". The shop's
// current database has exactly one users row — a placeholder written by test-print.js with
// the literal string 'placeholder' where a bcrypt hash belongs. Nobody can sign in as it,
// so "is the table empty" would answer the wrong question and leave the app locked out.
function seedAdmin() {
    if (countActiveAdmins() > 0) return;

    if (getUserByUsername('admin')) {
        console.warn(
            '\nWARNING: there is no active administrator, and the username "admin" is already taken.\n' +
            '         Re-activate an existing admin account, or create one under a different name.\n'
        );
        return;
    }

    // A generated password rather than a default like "admin". A default would be the same
    // string on every install of this app, and it would sit unchanged on a counter machine
    // for months. Set ADMIN_PASSWORD to choose your own.
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    createUser({ username: 'admin', password, full_name: 'Administrator', role: 'admin' });

    console.log('\n' + '='.repeat(64));
    console.log('  Created the first administrator account');
    console.log('='.repeat(64));
    console.log('  Username:  admin');
    console.log(`  Password:  ${password}`);
    console.log('\n  Shown once. It is stored only as a bcrypt hash, so it cannot be');
    console.log('  recovered later — write it down now. To pick your own, set');
    console.log('  ADMIN_PASSWORD before running setup on a fresh database.\n');
}

seedAdmin();
