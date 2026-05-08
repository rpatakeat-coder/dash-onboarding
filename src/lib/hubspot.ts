const HUBSPOT_PORTAL_ID = "24373118";

export const hubspotDealUrl = (id: number | string) =>
  `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${id}`;
