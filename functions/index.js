const functions = require("firebase-functions");
const fetch = require("node-fetch"); // Requires node-fetch@2
const cors = require("cors")({ origin: true });

exports.createSumUpCheckout = functions.https.onRequest((req, res) => {
  // Handle CORS
  cors(req, res, async () => {
    // 1. Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
      const { amount, description, reference } = req.body;

      // Log the incoming request for debugging in Firebase Console
      console.log(`Processing checkout for £${amount}. Ref: ${reference}`);

      const checkoutData = {
        checkout_reference: reference,
        amount: amount,
        currency: "GBP",
        merchant_code: "MRH0GKZC",
        description: description
      };

      // 2. Make the secure server-to-server request to SumUp
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
        console.error("SumUp API Error:", sumupResult);
        return res.status(sumupResponse.status).json({ 
          error: "SumUp rejected the request", 
          details: sumupResult 
        });
      }

      // 3. Send only the safe checkout ID back to the frontend
      return res.status(200).json({ checkoutId: sumupResult.id });

    } catch (error) {
      // This catch block captures the "500" crashes
      console.error("Function Crash Error:", error.message);
      return res.status(500).json({ 
        error: "Internal Server Error", 
        message: error.message 
      });
    }
  });
});