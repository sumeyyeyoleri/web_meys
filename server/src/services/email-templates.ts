import type { Locale, OrderStatus } from '@painter/shared';

interface EmailCopy {
  greeting: string;
  signOff: (businessName: string) => string;
  statusLabels: Record<OrderStatus, string>;
  passwordReset: { subject: string; body: (link: string) => string };
  statusChanged: { subject: (reference: string) => string; body: (reference: string, status: string, link: string) => string };
  newMessage: { subject: (reference: string) => string; body: (reference: string, link: string) => string };
  orderSubmitted: { subject: (reference: string) => string; body: (reference: string, link: string) => string };
}

const COPY: Record<Locale, EmailCopy> = {
  'nl-BE': {
    greeting: 'Dag,',
    signOff: (name) => `Met vriendelijke groeten,\n${name}`,
    statusLabels: {
      SUBMITTED: 'Ingediend',
      UNDER_REVIEW: 'In behandeling',
      AWAITING_CUSTOMER_INFO: 'Wacht op uw informatie',
      QUOTE_SENT: 'Offerte verstuurd',
      ACCEPTED: 'Aanvaard',
      IN_PROGRESS: 'In uitvoering',
      COMPLETED: 'Afgerond',
      CANCELLED: 'Geannuleerd',
    },
    passwordReset: {
      subject: 'Uw wachtwoord opnieuw instellen',
      body: (link) =>
        `We hebben een aanvraag ontvangen om uw wachtwoord opnieuw in te stellen.\n\nKlik op de onderstaande link (1 uur geldig):\n${link}\n\nHebt u dit niet zelf aangevraagd? Dan mag u deze e-mail negeren.`,
    },
    statusChanged: {
      subject: (ref) => `Uw bestelling ${ref} werd bijgewerkt`,
      body: (ref, status, link) => `De status van uw bestelling ${ref} is nu: ${status}.\n\nBekijk de details in uw account:\n${link}`,
    },
    newMessage: {
      subject: (ref) => `Nieuw bericht over bestelling ${ref}`,
      body: (ref, link) => `Er is een nieuw bericht over bestelling ${ref}.\n\nLees en beantwoord het hier:\n${link}`,
    },
    orderSubmitted: {
      subject: (ref) => `Nieuwe aanvraag ${ref}`,
      body: (ref, link) => `Er werd een nieuwe aanvraag ingediend: ${ref}.\n\n${link}`,
    },
  },
  en: {
    greeting: 'Hello,',
    signOff: (name) => `Kind regards,\n${name}`,
    statusLabels: {
      SUBMITTED: 'Submitted',
      UNDER_REVIEW: 'Under review',
      AWAITING_CUSTOMER_INFO: 'Awaiting your information',
      QUOTE_SENT: 'Quote sent',
      ACCEPTED: 'Accepted',
      IN_PROGRESS: 'In progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    },
    passwordReset: {
      subject: 'Reset your password',
      body: (link) =>
        `We received a request to reset your password.\n\nUse the link below (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    },
    statusChanged: {
      subject: (ref) => `Your order ${ref} has been updated`,
      body: (ref, status, link) => `The status of your order ${ref} is now: ${status}.\n\nSee the details in your account:\n${link}`,
    },
    newMessage: {
      subject: (ref) => `New message about order ${ref}`,
      body: (ref, link) => `There is a new message about order ${ref}.\n\nRead and reply here:\n${link}`,
    },
    orderSubmitted: {
      subject: (ref) => `New request ${ref}`,
      body: (ref, link) => `A new request was submitted: ${ref}.\n\n${link}`,
    },
  },
  tr: {
    greeting: 'Merhaba,',
    signOff: (name) => `Saygılarımızla,\n${name}`,
    statusLabels: {
      SUBMITTED: 'Gönderildi',
      UNDER_REVIEW: 'İnceleniyor',
      AWAITING_CUSTOMER_INFO: 'Bilgilerinizi bekliyor',
      QUOTE_SENT: 'Teklif gönderildi',
      ACCEPTED: 'Kabul edildi',
      IN_PROGRESS: 'Hazırlanıyor',
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal edildi',
    },
    passwordReset: {
      subject: 'Şifrenizi sıfırlayın',
      body: (link) =>
        `Şifrenizi sıfırlamak için bir talep aldık.\n\nAşağıdaki bağlantıyı kullanın (1 saat geçerlidir):\n${link}\n\nBu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
    },
    statusChanged: {
      subject: (ref) => `${ref} numaralı siparişiniz güncellendi`,
      body: (ref, status, link) => `${ref} numaralı siparişinizin durumu: ${status}.\n\nAyrıntıları hesabınızda görebilirsiniz:\n${link}`,
    },
    newMessage: {
      subject: (ref) => `${ref} numaralı sipariş hakkında yeni mesaj`,
      body: (ref, link) => `${ref} numaralı sipariş hakkında yeni bir mesaj var.\n\nOkumak ve yanıtlamak için:\n${link}`,
    },
    orderSubmitted: {
      subject: (ref) => `Yeni talep: ${ref}`,
      body: (ref, link) => `Yeni bir talep gönderildi: ${ref}.\n\n${link}`,
    },
  },
};

export function emailCopy(locale: Locale): EmailCopy {
  return COPY[locale];
}

export function wrapEmail(locale: Locale, businessName: string, body: string): string {
  const copy = COPY[locale];
  return `${copy.greeting}\n\n${body}\n\n${copy.signOff(businessName)}\n`;
}
