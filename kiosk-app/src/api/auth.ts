import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface SendVerificationResponse {
  success: boolean;
  message: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
}

export const sendVerificationCode = async (email: string): Promise<SendVerificationResponse> => {
  const response = await axios.post(`${API_URL}/api/auth/send-verification-code`, {
    email,
  });
  return response.data;
};

export const verifyCode = async (email: string, passcode: string): Promise<VerifyCodeResponse> => {
  const response = await axios.post(`${API_URL}/api/auth/verify-code`, {
    email,
    passcode,
  });
  return response.data;
};


