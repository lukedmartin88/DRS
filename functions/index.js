const functions = require("firebase-functions");
const fetch = require("node-fetch"); // Ensure you ran: npm install node-fetch@2
const cors = require("cors")({ origin: true });

exports.createSumUpCheckout = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
      const { amount, description, reference } = req.body;

      const checkoutData = {
        checkout_reference: reference,
        amount: parseFloat(amount),
        currency: "GBP",
        // Using the exact merchant code as defined in your dashboard
        merchant_code: "MRH0GKZC", 
        description: description
      };

      const sumupResponse = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sup_sk_sV6JMO79rGPPlejRuYWkz4aBSC7hWPyUk',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkoutData)
      });

      const sumupResult = await sumupResponse.json();

      if (!sumupResponse.ok) {
        return res.status(sumupResponse.status).json({ error: "SumUp Rejected", details: sumupResult });
      }

      return res.status(200).json({ checkoutId: sumupResult.id });

    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  });
});