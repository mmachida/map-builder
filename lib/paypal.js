function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function assertPayPalConfigured() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal nao esta configurado.");
  }
}

export async function getPayPalAccessToken() {
  assertPayPalConfigured();

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Erro ao autenticar no PayPal.");
  }

  return data.access_token;
}

export async function createPayPalOrder({ plan, returnUrl, cancelUrl }) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: plan.description,
          amount: {
            currency_code: plan.currency,
            value: plan.amount,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Map Builder",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao criar pedido no PayPal.");
  }

  return data;
}

export async function capturePayPalOrder(paypalOrderId) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao capturar pagamento no PayPal.");
  }

  return data;
}

export async function getPayPalOrder(paypalOrderId) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${paypalOrderId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao consultar pedido no PayPal.");
  }

  return data;
}

export async function verifyPayPalWebhook({ headers, event }) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return { verified: false, skipped: true };
  }

  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo") || "",
        cert_url: headers.get("paypal-cert-url") || "",
        transmission_id: headers.get("paypal-transmission-id") || "",
        transmission_sig: headers.get("paypal-transmission-sig") || "",
        transmission_time: headers.get("paypal-transmission-time") || "",
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao verificar webhook do PayPal.");
  }

  return {
    verified: data.verification_status === "SUCCESS",
    skipped: false,
    verificationStatus: data.verification_status,
  };
}
