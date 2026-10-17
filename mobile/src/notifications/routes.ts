// Bildirishnomani bosganda qaysi ekran ochiladi (sof mantiq). Nusxa: mobile/src/notifications/routes.ts (shared/notification-routes.spec.ts ikkalasi bir xil ekanini tekshiradi).
// Push `data` ichida faqat id'lar va tur bo'ladi; id'lar UUID ekanligi tekshiriladi (navigatsiya manzilini begona matn buzmasligi uchun).
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const id = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null);

export function routeFor(type: string, data?: Record<string, unknown> | null): string | null {
  const d = data ?? {};
  switch (type) {
    case 'message.new': {
      const t = id(d.threadId);
      return t ? `/market/thread/${t}` : '/market/threads';
    }
    case 'booking.requested':
      return '/market/requests';
    case 'booking.confirmed':
    case 'booking.declined':
    case 'booking.cancelled':
    case 'booking.expired':
    case 'booking.reschedule_proposed':
    case 'booking.counter_offer':
    case 'booking.reminder':
      return '/market/lessons';
    case 'review.new':
    case 'review.reply':
      return '/market/reviews';
    case 'class.live':
    case 'class.reminder_day':
    case 'class.reminder_soon': {
      const s = id(d.sessionId);
      return s ? `/market/class-room/${s}` : '/market/classes';
    }
    case 'class.cancelled':
    case 'class.session_added':
    case 'class.session_cancelled':
    case 'class.teacher_noshow': {
      const c = id(d.classId);
      return c ? `/market/class/${c}` : '/market/classes';
    }
    case 'class.removed':
      return '/market/classes';
    case 'class.homework':
    case 'class.homework_marked': {
      const c = id(d.classId);
      return c ? `/market/class-homework/${c}` : '/market/classes';
    }
    case 'directpay.marked':
      return '/market/money';
    case 'directpay.confirmed':
    case 'directpay.not_received':
    case 'directpay.waived':
    case 'directpay.reminder':
    case 'classpay.reminder':
      return '/market/my-payments';
    case 'guardian.linked':
      return '/(tabs)/profile';
    case 'push.test':
      return '/market/notification-settings';
    default:
      return null;
  }
}
