const express = require('express');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// API Keys (aus Umgebungsvariablen)
const resend = new Resend(process.env.RESEND_API_KEY);
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

// E-Mail Empfänger
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'dominik.sitny@gmail.com';

// HubSpot Portal ID für Links
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '147486387';

app.use(express.json());

// Kontaktdaten von HubSpot API holen
async function getContactDetails(contactId) {
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('HubSpot API Fehler:', response.status);
      return null;
    }

    const data = await response.json();
    return data.properties;
  } catch (error) {
    console.error('Fehler beim Abrufen der Kontaktdaten:', error);
    return null;
  }
}

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  console.log('Webhook empfangen:', JSON.stringify(req.body, null, 2));

  // HubSpot sendet ein Array von Events
  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const event of events) {
    // Nur bei neuen Kontakten E-Mail senden
    if (event.subscriptionType === 'object.creation' && event.objectTypeId === '0-1') {
      const contactId = event.objectId;
      const hubspotLink = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`;

      // Kontaktdaten von HubSpot holen
      const contact = await getContactDetails(contactId);
      const firstname = contact?.firstname || 'Unbekannt';
      const lastname = contact?.lastname || '';
      const email = contact?.email || 'Keine E-Mail';
      const fullName = `${firstname} ${lastname}`.trim();

      try {
        await resend.emails.send({
          from: 'HubSpot Notification <onboarding@resend.dev>',
          to: NOTIFY_EMAIL,
          subject: `Neuer Kontakt: ${fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ff7a59;">Neuer Kontakt in HubSpot!</h2>

              <div style="background: #f5f8fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>👤 Name:</strong> ${fullName}</p>
                <p><strong>📧 E-Mail:</strong> ${email}</p>
                <p><strong>📅 Erstellt am:</strong> ${new Date(event.occurredAt).toLocaleString('de-DE')}</p>
                <p><strong>🔗 Quelle:</strong> ${event.changeSource || 'Unbekannt'}</p>
              </div>

              <a href="${hubspotLink}"
                 style="display: inline-block; background: #ff7a59; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                In HubSpot öffnen
              </a>

              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Diese E-Mail wurde automatisch von deinem Webhook-Server gesendet.
              </p>
            </div>
          `
        });
        console.log(`E-Mail gesendet für Kontakt ${contactId} (${fullName})`);
      } catch (error) {
        console.error('Fehler beim E-Mail-Versand:', error);
      }
    }
  }

  // HubSpot erwartet 200 OK
  res.status(200).send('OK');
});

// Health Check
app.get('/', (req, res) => {
  res.send('Webhook Server läuft!');
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
