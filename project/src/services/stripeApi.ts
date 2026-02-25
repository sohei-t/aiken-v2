import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { StripeSessionResult } from '../types';

const functions = getFunctions(app, 'asia-northeast1');

export const createCheckoutSession = async (): Promise<StripeSessionResult> => {
  const fn = httpsCallable<void, StripeSessionResult>(functions, 'createCheckoutSession');
  const result = await fn();
  return result.data;
};

export const createPortalSession = async (): Promise<StripeSessionResult> => {
  const fn = httpsCallable<void, StripeSessionResult>(functions, 'createPortalSession');
  const result = await fn();
  return result.data;
};
