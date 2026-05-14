const functions = require("firebase-functions");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true });

exports.createSumUpCheckout = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // 1. Ensure this is a POST request
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const { amount, description, reference } = req.body;

      const checkoutData = {
        checkout_reference: reference,
        amount: amount,
        currency: "GBP",
        merchant_code: "MRH0GKZC", // Your Merchant Code is safe here
        description: description
      };

      // 2. Make the secure server-to-server request to SumUp
      const sumupResponse = await fetch('[https://api.sumup.com/v0.1/checkouts](https://api.sumup.com/v0.1/checkouts)', {
        method: 'POST',
        headers: {
          // Your Secret Key is completely hidden from the front-end!
          'Authorization': 'Bearer sup_sk_sV6JMO79rGPPlejRuYWkz4aBSC7hWPyUk',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkoutData)
      });

      if (!sumupResponse.ok) {
         throw new Error('SumUp API rejected the request.');
      }

      const sumupResult = await sumupResponse.json();

      // 3. Send only the safe checkout ID back to the front-end app
      res.status(200).json({ checkoutId: sumupResult.id });

    } catch (error) {
      console.error("Payment Gateway Error:", error);
      res.status(500).json({ error: "Failed to generate checkout link" });
    }
  });
});