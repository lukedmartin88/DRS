const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

exports.createSumUpCheckout = onRequest({ secrets: [] }, async (req, res) => {
  cors(req, res, async () => {
    
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
      const { reference, amount, description } = req.body;

      if (!reference || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const checkoutResponse = await fetch("https://api.sumup.com/v0.1/checkouts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SUMUP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkout_reference: reference,
          amount: amount,
          currency: "GBP",
          description: description,
          merchant_code: process.env.MRH0GKZC
        }),
      });

      if (!checkoutResponse.ok) {
        const checkoutError = await checkoutResponse.text();
        console.error("SumUp Checkout Error:", checkoutError);
        throw new Error("Failed to create checkout session");
      }

      const checkoutData = await checkoutResponse.json();
      return res.status(200).json({ checkoutId: checkoutData.id });

    } catch (error) {
      console.error("Checkout process failed:", error);
      return res.status(500).json({ error: "Internal server error during checkout" });
    }
  });
});