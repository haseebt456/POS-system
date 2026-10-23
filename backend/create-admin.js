// Account administration from the command line.
//
// This exists because of a specific failure: the app can start perfectly, serve the login
// screen, and still be impossible to sign into — if no row in `users` holds a real bcrypt
// hash. Nothing about the users table says so. A row with 'placeholder' in password_hash,
// or one inserted by hand in DB Browser without hashing the password, looks exactly like a
// working account until someone tries to use it.
//
// Run with no arguments first. It reads the database and tells you what is actually there.
//
//   node create-admin.js                            report on every account
//   node create-admin.js set admin                  create or reset 'admin', password printed once
//   node create-admin.js set admin MyPassword123    choose the password yourself
//   node create-admin.js operator haseeb 4321 "Haseeb"   a till account that signs in by PIN
//   node create-admin.js pin admin 4321             give an existing account a till PIN
//   node create-admin.js clear-pin admin            take an account off the till PIN pad
//   node create-admin.js activate admin             re-enable a deactivated account
//
// The filename says create-admin because that was the first thing it needed to do. It
// manages accounts generally now: Settings → Staff Accounts (M7) will be the UI for this,
// and until then this is the only way to create an operator.
//
// POS_DB_PATH is respected, so this can be pointed at a copy of the live database — which is
// the right way to look before touching the real one.
const crypto = require('crypto');
const db = require('./db');
const { runMigrations } = require('./migrate');
const {
    createUser,
    getUserByUsername,
    isUsableHash,
    setPassword,
    setPin,
    updateUser,
} = require('./models/user');
const { deleteSessionsForUser } = require('./models/session');

runMigrations();

// The path matters: this is the single most common reason a fix "doesn't work" — the command
// was pointed at a different database than the server is using.
console.log(`Database: ${db.name}\n`);

function report() {
    const rows = db.prepare(`
        SELECT id, username, full_name, role, is_active, password_hash, pin_hash
        FROM users ORDER BY id
    `).all();

    if (!rows.length) {
        console.log('No accounts at all. Create one:  node create-admin.js set admin');
        return;
    }

    console.log('id  username        role      active  password      pin   can sign in?');
    console.log('-'.repeat(78));

    for (const row of rows) {
        const active = row.is_active === 1;
        const hasPassword = isUsableHash(row.password_hash);
        const hasPin = typeof row.pin_hash === 'string' && row.pin_hash.length > 0;

        // The two ways in. An account with neither is a row, not a login.
        const canSignIn = active && (hasPassword || hasPin);

        console.log(
            [
                String(row.id).padEnd(3),
                String(row.username ?? '').padEnd(15),
                String(row.role ?? '').padEnd(9),
                (active ? 'yes' : 'NO').padEnd(7),
                (hasPassword ? 'ok' : 'NOT A HASH').padEnd(13),
                (hasPin ? 'yes' : '-').padEnd(5),
                canSignIn ? 'yes' : 'NO',
            ].join(' ')
        );

        if (!hasPassword && row.password_hash !== null) {
            console.log(
                `    ^ password_hash is not a bcrypt hash (${JSON.stringify(
                    String(row.password_hash).slice(0, 40)
                )}). Nobody can sign in as "${row.username}" with a password.`
            );
        }
    }

    const admins = rows.filter((r) => r.role === 'admin' && r.is_active === 1 && isUsableHash(r.password_hash));
    console.log(
        `\n${admins.length} usable administrator account(s).` +
            (admins.length ? '' : '  Without one, Settings is unreachable once signed in as anyone else.')
    );

    // Worth saying out loud. The PIN pad lists admins next to operators, and a PIN session
    // carries the role of the ACCOUNT — so an admin with a PIN is an admin anyone at the
    // counter can sign in as with four digits. The pad even says which name to use.
    const adminsOnThePad = rows.filter(
        (r) => r.role === 'admin' && r.is_active === 1 && typeof r.pin_hash === 'string' && r.pin_hash
    );

    if (adminsOnThePad.length) {
        console.log(
            `\nNOTE: ${adminsOnThePad.length} administrator account(s) can be signed into from the ` +
                'till PIN pad — ' +
                adminsOnThePad.map((r) => r.username).join(', ') +
                '.\n      A PIN is 4 digits and the pad lists the names. If that is not what you want,\n' +
                '      take them off it:  node create-admin.js clear-pin <username>'
        );
    }
}

function makeAdmin(username, password) {
    const existing = getUserByUsername(username);
    const secret = password || crypto.randomBytes(9).toString('base64url');

    if (existing) {
        setPassword(existing.id, secret);
        updateUser(existing.id, { role: 'admin', is_active: 1 });
        // A password change must not leave old sessions alive — they were issued against a
        // credential that no longer exists.
        const killed = deleteSessionsForUser(existing.id);
        console.log(`Reset the password for "${username}" (id ${existing.id}) and made it an active admin.`);
        if (killed) console.log(`Signed out ${killed} existing session(s) for that account.`);
    } else {
        createUser({ username, password: secret, full_name: 'Administrator', role: 'admin' });
        console.log(`Created administrator "${username}".`);
    }

    console.log('\n' + '='.repeat(64));
    console.log('  Username:  ' + username);
    console.log('  Password:  ' + secret);
    console.log('='.repeat(64));
    console.log('  Shown once — only a bcrypt hash is stored, so it cannot be recovered.\n');
}

// A till account: a PIN and nothing else. createUser() gives it an unusable random password
// hash rather than leaving the column null, so there is no password to guess and no branch
// on null at every call site.
//
// `full_name` is not decoration — the PIN pad renders it, and falls back to "Unnamed", so an
// account without one is a name nobody can recognise at a glance across a counter.
function makeOperator(username, pin, fullName) {
    const existing = getUserByUsername(username);

    if (existing) {
        setPin(existing.id, pin);
        if (fullName) updateUser(existing.id, { full_name: fullName });
        console.log(`"${username}" already existed — set its PIN.`);
        return;
    }

    createUser({ username, pin, full_name: fullName || username, role: 'operator' });
    console.log(`Created till account "${username}". It appears on the PIN pad; it has no password.`);
}

function makePin(username, pin) {
    const user = getUserByUsername(username);
    if (!user) throw new Error(`No account named "${username}"`);
    setPin(user.id, pin);
    if (user.is_active !== 1) updateUser(user.id, { is_active: 1 });
    console.log(`"${username}" can now sign in at the till with that PIN.`);
}

// setPin(id, '') writes NULL, which is what removes someone from the PIN pad — see
// listOperators(), which only returns rows with a pin_hash.
function clearPin(username) {
    const user = getUserByUsername(username);
    if (!user) throw new Error(`No account named "${username}"`);
    if (!user.pin_hash) {
        console.log(`"${username}" has no PIN to remove.`);
        return;
    }
    setPin(user.id, '');
    console.log(`"${username}" no longer appears on the till PIN pad. Password sign-in is unaffected.`);
}

function activate(username) {
    const user = getUserByUsername(username);
    if (!user) throw new Error(`No account named "${username}"`);
    updateUser(user.id, { is_active: 1 });
    console.log(`"${username}" is active again.`);
}

const [action, ...rest] = process.argv.slice(2);

try {
    if (!action) {
        report();
    } else if (action === 'report') {
        report();
    } else if (action === 'set') {
        const [username, password] = rest;
        if (!username) throw new Error('Usage: node create-admin.js set <username> [password]');
        makeAdmin(username, password);
        console.log('--- Database now ---');
        report();
    } else if (action === 'operator') {
        const [username, pin, ...nameParts] = rest;
        if (!username || !pin) {
            throw new Error('Usage: node create-admin.js operator <username> <pin> ["Full Name"]');
        }
        makeOperator(username, pin, nameParts.join(' ') || null);
    } else if (action === 'pin') {
        const [username, pin] = rest;
        if (!username || !pin) throw new Error('Usage: node create-admin.js pin <username> <pin>');
        makePin(username, pin);
    } else if (action === 'clear-pin') {
        const [username] = rest;
        if (!username) throw new Error('Usage: node create-admin.js clear-pin <username>');
        clearPin(username);
    } else if (action === 'activate') {
        const [username] = rest;
        if (!username) throw new Error('Usage: node create-admin.js activate <username>');
        activate(username);
    } else {
        console.error(`Unknown command "${action}". Run with no arguments for a report.`);
        process.exit(1);
    }
} catch (err) {
    console.error(`\nFailed: ${err.message}\n`);
    process.exit(1);
}
