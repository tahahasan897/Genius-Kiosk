# Firebase Emulator Quick Start Guide

This setup automatically creates test users every time the emulator starts, and the backend automatically syncs their Firebase UIDs.

## 🚀 Initial Setup (One Time)

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Seed Database with Test Users
```bash
# Replace with your actual database credentials
psql -h 172.23.32.1 -p 5433 -U postgres -d kiosk_system \
  -f scripts/seed-db-admins.sql
```

This creates three test admins in the database:
- `superadmin@test.com` - Super admin
- `chainadmin@test.com` - Chain admin (chain 1)
- `admin2@test.com` - Chain admin (chain 2)

## 🏃 Daily Development Workflow

### Terminal 1: Start Emulator with Auto-Seeded Users
```bash
cd kiosk-app
npm run emulator:start:auto
```

You'll see:
```
✅ Created: superadmin@test.com
   UID: abc123...
   Role: Super Admin

✅ Created: chainadmin@test.com
   UID: xyz789...
   Role: Chain Admin
   Chains: 1
```

### Terminal 2: Start Frontend in Emulator Mode
```bash
cd kiosk-app
npm run dev:emulator
```

### Login
Go to http://localhost:5173/super-admin/login

**Login credentials:**
- Email: `superadmin@test.com`
- Password: `password123`

**Magic:** The backend automatically updates the Firebase UID in the database when you sign in! 🎉

## 📁 Configuration Files

### `emulator-test-users.json` - Define Test Users
```json
{
  "users": [
    {
      "email": "superadmin@test.com",
      "password": "password123",
      "displayName": "Super Admin Test",
      "isSuperAdmin": true
    }
  ]
}
```

Edit this file to add more test users.

### `scripts/seed-db-admins.sql` - Database Seeding
Pre-configured SQL to create admin records in the database.

### `scripts/seed-emulator-users.js` - Auto-Create Firebase Users
Automatically creates users in the emulator from the JSON config.

## 🔄 How It Works

```
┌─────────────────────────────────────────────────────────┐
│ 1. Emulator starts                                      │
│ 2. Script reads emulator-test-users.json               │
│ 3. Creates users in Firebase Emulator                   │
│    - superadmin@test.com → UID: abc123                  │
│    - chainadmin@test.com → UID: xyz789                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ User signs in via frontend                              │
│ - Frontend sends Firebase UID to backend                │
│ - Backend checks admin_users table by firebase_uid      │
│ - Not found? Check by email instead                     │
│ - Found by email? Update firebase_uid automatically     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ User authenticated! ✅                                   │
│ - Database now has current Firebase UID                 │
│ - User can access admin panel                           │
└─────────────────────────────────────────────────────────┘
```

## 💡 Key Benefits

✅ **Zero API quota usage** - Test unlimited times
✅ **Auto-recreates users** - Same users every restart
✅ **Auto-syncs UIDs** - No manual database updates
✅ **Easy to modify** - Edit JSON file, restart emulator
✅ **Production-identical** - Same Firebase Auth API

## 🛠️ Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run emulator:start:auto` | Start emulator + auto-seed users |
| `npm run emulator:start` | Start emulator only (manual) |
| `npm run emulator:seed` | Manually seed users (after emulator running) |
| `npm run dev:emulator` | Start frontend in emulator mode |
| `npm run dev` | Start frontend in production mode |

## 🔍 Troubleshooting

### "Access Denied" when signing in

1. Check backend terminal - look for `/me` endpoint logs
2. Verify user exists in database:
   ```sql
   SELECT email, is_super_admin FROM admin_users
   WHERE email = 'superadmin@test.com';
   ```
3. Check browser DevTools → Network → `/api/super-admin/me` response

### Users not created in emulator

1. Wait 5 seconds after emulator starts
2. Check emulator UI: http://localhost:4000 → Authentication
3. Manually run: `npm run emulator:seed`

### Backend can't connect to database

Check your database credentials in `backend/.env` or connection string.

## 🎯 Adding New Test Users

1. Edit `emulator-test-users.json`:
   ```json
   {
     "users": [
       {
         "email": "newadmin@test.com",
         "password": "password123",
         "displayName": "New Admin",
         "isSuperAdmin": false,
         "chainIds": [3]
       }
     ]
   }
   ```

2. Add to database:
   ```sql
   INSERT INTO admin_users (email, firebase_uid, display_name, is_super_admin)
   VALUES ('newadmin@test.com', 'pending', 'New Admin', false);

   INSERT INTO admin_chain_assignments (user_id, chain_id)
   SELECT user_id, 3 FROM admin_users WHERE email = 'newadmin@test.com';
   ```

3. Restart emulator: `npm run emulator:start:auto`

4. Sign in with `newadmin@test.com` / `password123` ✅
