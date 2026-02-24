const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const APP_URL = process.env.APP_URL || "https://personal-video-platform.web.app";

// Helper: get or create Stripe customer for a Firebase user
async function getOrCreateStripeCustomer(stripe, uid) {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data();

  if (userData?.stripeCustomerId) {
    return userData.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    metadata: { firebaseUID: uid },
    email: userData?.email || undefined,
    name: userData?.displayName || undefined,
  });

  // Save to Firestore
  await userRef.update({ stripeCustomerId: customer.id });

  return customer.id;
}

// Helper: find Firebase user by Stripe customer ID
async function findUserByStripeCustomerId(customerId) {
  const usersRef = db.collection("users");
  const snapshot = await usersRef
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return { uid: snapshot.docs[0].id, ref: snapshot.docs[0].ref };
}

// ─── createCheckoutSession ───────────────────────────────────
exports.createCheckoutSession = onCall(
  { region: "asia-northeast1", secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です");
    }

    const uid = request.auth.uid;
    const stripe = new Stripe(stripeSecretKey.value());

    const customerId = await getOrCreateStripeCustomer(stripe, uid);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${APP_URL}/?subscription=success`,
      cancel_url: `${APP_URL}/pricing`,
      locale: "ja",
      metadata: { firebaseUID: uid },
    });

    return { url: session.url };
  }
);

// ─── createPortalSession ─────────────────────────────────────
exports.createPortalSession = onCall(
  { region: "asia-northeast1", secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です");
    }

    const uid = request.auth.uid;
    const stripe = new Stripe(stripeSecretKey.value());

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (!userData?.stripeCustomerId) {
      throw new HttpsError(
        "failed-precondition",
        "サブスクリプション情報が見つかりません"
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: `${APP_URL}/account`,
    });

    return { url: portalSession.url };
  }
);

// ─── stripeWebhook ───────────────────────────────────────────
exports.stripeWebhook = onRequest(
  {
    region: "asia-northeast1",
    secrets: [stripeSecretKey, stripeWebhookSecret],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log(`Received event: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "subscription" && session.customer) {
            const user = await findUserByStripeCustomerId(session.customer);
            if (user) {
              await user.ref.update({
                subscriptionStatus: "active",
                subscriptionId: session.subscription,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`User ${user.uid} subscription activated`);
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const user = await findUserByStripeCustomerId(
            subscription.customer
          );
          if (user) {
            const updateData = {
              subscriptionStatus: subscription.status,
              subscriptionId: subscription.id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (subscription.current_period_end) {
              updateData.subscriptionCurrentPeriodEnd =
                admin.firestore.Timestamp.fromMillis(
                  subscription.current_period_end * 1000
                );
            }

            if (subscription.cancel_at_period_end) {
              updateData.subscriptionCanceledAt =
                admin.firestore.FieldValue.serverTimestamp();
            } else {
              updateData.subscriptionCanceledAt = null;
            }

            await user.ref.update(updateData);
            console.log(
              `User ${user.uid} subscription updated: ${subscription.status}`
            );
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const user = await findUserByStripeCustomerId(
            subscription.customer
          );
          if (user) {
            await user.ref.update({
              subscriptionStatus: "canceled",
              subscriptionId: null,
              subscriptionCurrentPeriodEnd: null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`User ${user.uid} subscription canceled`);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          if (invoice.customer) {
            const user = await findUserByStripeCustomerId(invoice.customer);
            if (user) {
              await user.ref.update({
                subscriptionStatus: "past_due",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`User ${user.uid} payment failed`);
            }
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      console.error(`Error processing ${event.type}:`, err);
    }

    res.status(200).json({ received: true });
  }
);
