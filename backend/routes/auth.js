import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const router = express.Router();

// In-memory store for verification codes (in production, use Redis or database)
const verificationCodes = new Map();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Configure email transporter
const createTransporter = () => {
  // Option 1: Gmail (requires app password)
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // App password, not regular password
      },
    });
  }
  
  // Option 2: SMTP (works with most email providers)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  
  // Option 3: Development - console only (no actual email sent)
  console.log('⚠️ Email not configured. Verification codes will be logged to console.');
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
};

const transporter = createTransporter();

// Generate 6-digit passcode
const generatePasscode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Send verification code
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    
    // Generate passcode
    const passcode = generatePasscode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Store passcode
    verificationCodes.set(email.toLowerCase(), {
      passcode,
      expiresAt,
      attempts: 0,
    });
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@aislegenius.com',
      to: email,
      subject: 'Your Verification Passcode - Aisle Genius',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Thank you for creating an account. Please use the following passcode to verify your email address:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #0066cc; font-size: 32px; letter-spacing: 5px; margin: 0;">${passcode}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your verification passcode is: ${passcode}. This code will expire in 10 minutes.`,
    };
    
    try {
      await transporter.sendMail(mailOptions);
      
      res.json({ 
        success: true, 
        message: 'Verification code sent to your email',
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      verificationCodes.delete(email.toLowerCase());
      return res.status(500).json({ 
        error: 'Failed to send verification email. Please check your email configuration.',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
      });
    }
  } catch (error) {
    console.error('Error in send-verification-code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify code
router.post('/verify-code', async (req, res) => {
  try {
    const { email, passcode } = req.body;
    
    if (!email || !passcode) {
      return res.status(400).json({ error: 'Email and passcode are required' });
    }
    
    const emailKey = email.toLowerCase();
    const stored = verificationCodes.get(emailKey);
    
    if (!stored) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }
    
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(emailKey);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }
    
    if (stored.attempts >= 5) {
      verificationCodes.delete(emailKey);
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
    }
    
    if (stored.passcode !== passcode) {
      stored.attempts += 1;
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }
    
    // Code is valid - remove it
    verificationCodes.delete(emailKey);
    
    res.json({ 
      success: true, 
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Error in verify-code:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

export default router;

