const express = require('express');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// Resend API Key (aus Umgebungsvariable oder hardcoded für lokale Entwicklung)
const resend = new Resend(process.env.RESEND_API_KEY || 're_YvJh5iKY_Gjva42hZFj8R9QZfm59S4Vsj');

// E-Mail Empfänger
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'dominik.sitny@gmail.com';

// HubSpot Portal ID für Links
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '147486387';

app.use(express.json());

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

      try {
        await resend.emails.send({
          from: 'HubSpot Notification <onboarding@resend.dev>',
          to: NOTIFY_EMAIL,
          subject: `Neuer Kontakt erstellt (ID: ${contactId})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ff7a59;">Neuer Kontakt in HubSpot!</h2>

              <div style="background: #f5f8fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Kontakt ID:</strong> ${contactId}</p>
                <p><strong>Erstellt am:</strong> ${new Date(event.occurredAt).toLocaleString('de-DE')}</p>
                <p><strong>Quelle:</strong> ${event.changeSource || 'Unbekannt'}</p>
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
        console.log(`E-Mail gesendet für Kontakt ${contactId}`);
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
  console.log('Starte ngrok in einem anderen Terminal: ./ngrok http 3001');
});
