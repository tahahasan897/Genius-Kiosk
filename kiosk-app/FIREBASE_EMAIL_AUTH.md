# Firebase Email/Password Authentication Setup

The admin login page now supports both Google sign-in and email/password authentication. This guide explains how to enable email/password authentication in Firebase.

## Enable Email/Password Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** in the left sidebar
4. Click on **Get started** if you haven't enabled Authentication yet
5. Go to the **Sign-in method** tab
6. Click on **Email/Password** in the providers list
7. Enable the **Email/Password** toggle
8. Optionally enable **Email link (passwordless sign-in)** if desired
9. Click **Save**

## Using Email/Password Authentication

Once enabled, users can:

1. **Create Account**: Click "Create Account" tab on the login page
   - Enter email
   - Enter password (minimum 6 characters)
   - Confirm password
   - Click "Create Account"

2. **Sign In**: Use the "Sign In" tab
   - Enter registered email
   - Enter password
   - Click "Sign In"

## Error Handling

The app handles common Firebase authentication errors:

- **Email already in use**: Shown when trying to create an account with an existing email
- **Weak password**: Password must be at least 6 characters
- **User not found**: Shown when trying to sign in with an unregistered email
- **Wrong password**: Incorrect password for existing account
- **Invalid email**: Email format is invalid

## Security Notes

- Passwords must be at least 6 characters (Firebase requirement)
- All passwords are securely hashed by Firebase
- Firebase handles all authentication security and encryption
- No password is stored in plain text

