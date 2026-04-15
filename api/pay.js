export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    return res.status(500).json({ error: 'Payment configuration missing' });
  }

  const idempotenceKey = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36);

  const payload = {
    amount: {
      value: '4990.00',
      currency: 'RUB'
    },
    confirmation: {
      type: 'redirect',
      return_url: 'https://developer-calculator-site.vercel.app/thanks.html'
    },
    capture: true,
    description: 'Калькулятор инвестора — Деньги в Квадрате (полная версия)',
    receipt: {
      customer: {
        email: 'customer@example.com'
      },
      items: [
        {
          description: 'Калькулятор инвестора — полная версия',
          quantity: '1.00',
          amount: {
            value: '4990.00',
            currency: 'RUB'
          },
          vat_code: 1,
          payment_mode: 'full_payment',
          payment_subject: 'service'
        }
      ]
    }
  };

  // If email passed as query param, use it
  const email = req.query && req.query.email;
  if (email) {
    payload.receipt.customer.email = email;
  }

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(shopId + ':' + secretKey).toString('base64'),
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('YooKassa error:', JSON.stringify(data));
      return res.status(response.status).json({ error: 'Payment creation failed', details: data });
    }

    const redirectUrl = data.confirmation && data.confirmation.confirmation_url;
    if (redirectUrl) {
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    }

    return res.status(500).json({ error: 'No redirect URL received' });
  } catch (err) {
    console.error('Payment error:', err);
    return res.status(500).json({ error: 'Payment service unavailable' });
  }
}
