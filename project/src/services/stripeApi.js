import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'asia-northeast1');

export const createCheckoutSession = async () => {
  const fn = httpsCallable(functions, 'createCheckoutSession');
  const result = await fn();
  return result.data; // { url: "https://checkout.stripe.com/..." }
};

export const createPortalSession = async () => {
  const fn = httpsCallable(functions, 'createPortalSession');
  const result = await fn();
  return result.data; // { url: "https://billing.stripe.com/..." }
};
