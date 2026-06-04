export default async function updateRevenuecatCustomerEmail(
  appUserId: string,
  newEmail: string
) {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  const apiKey = process.env.REVENUECAT_API_KEY;

  if (!projectId || !apiKey)
    throw new Error(
      "Missing REVENUECAT_PROJECT_ID/REVENUECAT_API_KEY environment variables!"
    );

  const response = await fetch(
    `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(
      appUserId
    )}/attributes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: [
          {
            name: "$email",
            value: newEmail.toLowerCase().trim(),
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `RevenueCat API error: ${response.status} ${await response.text()}`
    );
  }
}
