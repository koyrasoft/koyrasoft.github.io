/**
 * Koyrasoft — Formulaire de contact (Google Apps Script)
 *
 * INSTALLATION (5 min) :
 * 1. Connectez-vous à https://script.google.com avec koyra.com@gmail.com
 * 2. Nouveau projet → collez ce fichier → enregistrez
 * 3. Déployer → Nouveau déploiement → Type : Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 4. Copiez l’URL se terminant par /exec
 * 5. Collez-la dans data/site.json → contact.formScriptUrl
 * 6. Resynchronisez data/site-data.js
 */

const RECIPIENT = "koyra.com@gmail.com";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function doGet() {
  return json_({ ok: true, service: "Koyrasoft contact form" });
}

function doPost(e) {
  try {
    const data = e.parameter || {};

    if (data._honey) {
      return redirect_(data.returnUrl || "https://koyrasoft.net/?sent=1#contact");
    }

    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const telephone = (data.telephone || "").trim();
    const entreprise = (data.entreprise || "").trim();
    const subject = (data.subject || "").trim() || "Demande de devis";
    const message = (data.message || "").trim();
    const lang = (data.lang || "fr").trim();
    const returnUrl = data.returnUrl || "https://koyrasoft.net/?sent=1#contact";

    if (!name || !email || !message) {
      throw new Error("Champs obligatoires manquants.");
    }

    const attachments = buildAttachments_(data);
    const mailSubject = "[Koyrasoft] " + subject + " — " + name;
    const adminBody = buildAdminBody_(name, email, telephone, entreprise, subject, message);

    // Notification à Koyrasoft + copie (CC) à l'expéditeur
    MailApp.sendEmail({
      to: RECIPIENT,
      cc: email,
      subject: mailSubject,
      body: adminBody,
      replyTo: email,
      name: "Koyrasoft",
      attachments: attachments,
    });

    // Email de confirmation séparé à l'expéditeur
    sendSenderCopy_(email, lang, name, telephone, entreprise, subject, message, attachments);

    return redirect_(returnUrl);
  } catch (err) {
    Logger.log("Erreur formulaire : " + err);
    const fallback = (e.parameter && e.parameter.returnUrl) || "https://koyrasoft.net/";
    const sep = fallback.indexOf("?") >= 0 ? "&" : "?";
    return redirect_(fallback + sep + "error=1#contact");
  }
}

function buildAttachments_(data) {
  if (!data.fileData || !data.fileName) return [];

  const bytes = Utilities.base64Decode(data.fileData);
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error("Fichier trop volumineux (max 10 Mo).");
  }

  return [
    Utilities.newBlob(
      bytes,
      data.fileMime || "application/octet-stream",
      data.fileName
    ),
  ];
}

function sendSenderCopy_(email, lang, name, telephone, entreprise, subject, message, attachments) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: copySubject_(lang),
      body: buildCopyBody_(lang, name, email, telephone, entreprise, subject, message, attachments.length > 0),
      name: "Koyrasoft",
      attachments: attachments,
    });
  } catch (err) {
    Logger.log("Copie expéditeur non envoyée : " + err);
  }
}

function buildAdminBody_(name, email, telephone, entreprise, subject, message) {
  const lines = [
    "Nouvelle demande depuis koyrasoft.net",
    "",
    "Nom : " + name,
    "Email : " + email,
  ];

  if (telephone) lines.push("Téléphone : " + telephone);
  if (entreprise) lines.push("Entreprise : " + entreprise);

  lines.push(
    "Projet : " + subject,
    "",
    "Message :",
    message,
    "",
    "---",
    "Envoyé le " + new Date().toLocaleString("fr-FR", { timeZone: "Africa/Bamako" })
  );

  return lines.join("\n");
}

function buildCopyBody_(lang, name, email, telephone, entreprise, subject, message, hasAttachment) {
  const isFr = lang !== "en";

  const lines = isFr
    ? [
        "Bonjour " + name + ",",
        "",
        "Merci pour votre demande adressée à Koyrasoft.",
        "Voici une copie de votre message :",
        "",
      ]
    : [
        "Hello " + name + ",",
        "",
        "Thank you for contacting Koyrasoft.",
        "Here is a copy of your message:",
        "",
      ];

  lines.push("Nom / Name : " + name);
  lines.push("Email : " + email);
  if (telephone) lines.push("Téléphone / Phone : " + telephone);
  if (entreprise) lines.push("Entreprise / Company : " + entreprise);
  lines.push("Projet / Project : " + subject, "", "Message :", message, "");

  if (hasAttachment) {
    lines.push(isFr ? "Fichier joint : inclus dans cet email." : "Attachment : included in this email.", "");
  }

  lines.push(
    isFr
      ? "Nous l'examinons et vous recontacterons sous 24 h ouvrées.\n\nL'équipe Koyrasoft\nkoyrasoft.net"
      : "We're reviewing it and will get back to you within 24 business hours.\n\nThe Koyrasoft team\nkoyrasoft.net"
  );

  return lines.join("\n");
}

function copySubject_(lang) {
  return lang === "en"
    ? "Copy of your request — Koyrasoft"
    : "Copie de votre demande — Koyrasoft";
}

function redirect_(url) {
  const safeUrl = String(url).replace(/"/g, "");
  const html =
    "<!DOCTYPE html><html><head>" +
    '<meta charset="UTF-8">' +
    '<meta http-equiv="refresh" content="0;url=' + safeUrl + '">' +
    "</head><body>" +
    "<script>location.replace(" + JSON.stringify(safeUrl) + ");</script>" +
    "</body></html>";

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode.ALLOWALL
  );
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
