# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/9dda2dd2-c69b-406a-9567-6f633d52de89

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/9dda2dd2-c69b-406a-9567-6f633d52de89) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/9dda2dd2-c69b-406a-9567-6f633d52de89) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## Development with Firebase Emulator

To avoid using Firebase API quotas during development, you can use the Firebase Auth Emulator. This provides a local authentication system that works exactly like production Firebase.

### One-time Setup

1. Install Firebase CLI globally:
```sh
npm install -g firebase-tools
```

2. Login to Firebase (required even for emulator):
```sh
firebase login
```

### Running the Emulator

You need **two terminals** to run the full development environment:

**Terminal 1 - Start Firebase Emulator (with auto-seeded test users):**
```sh
cd kiosk-app
npm run emulator:start:auto
```
This automatically:
- Starts the Auth Emulator on port 9099
- Creates test users from `emulator-test-users.json`
- Opens Emulator UI on port 4000

**Terminal 2 - Start the frontend with emulator mode:**
```sh
cd kiosk-app
npm run dev:emulator
```

**Alternative (manual):**
If you prefer to start the emulator without auto-seeding:
```sh
cd kiosk-app
npm run emulator:start  # Start emulator only
npm run emulator:seed   # Manually seed users later
```

### Using the Emulator UI

Open http://localhost:4000 in your browser to access the Firebase Emulator UI where you can:
- Create test users instantly
- View/edit user accounts
- Delete all users to start fresh
- No email verification required
- No API quotas consumed

### Setting Up Test Admin Users

**One-time database setup:**

Run the SQL script to add test users to your database:
```sh
psql -h <host> -p <port> -U <user> -d kiosk_system -f scripts/seed-db-admins.sql
```

This creates three test accounts:
- `superadmin@test.com` - Super admin with full access
- `chainadmin@test.com` - Chain admin for chain ID 1
- `admin2@test.com` - Chain admin for chain ID 2

All passwords: `password123`

**The backend automatically syncs Firebase UIDs**, so you don't need to manually update them when the emulator restarts!

**Adding more test users:**

1. Edit `emulator-test-users.json` to add new users
2. Restart the emulator with `npm run emulator:start:auto`
3. Add corresponding entries to the database

### Environment Files

- `.env` - Production Firebase config
- `.env.emulator` - Emulator mode (auto-loaded with `npm run dev:emulator`)

### Important Notes

- Emulator data is reset when you stop the emulator
- Google Sign-in works differently in emulator (creates a mock Google account)
- The backend still runs normally - only Firebase auth is emulated
- To switch back to production Firebase, just run `npm run dev` instead
