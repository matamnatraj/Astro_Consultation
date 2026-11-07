// Seed reference content and demo accounts. Idempotent: skips if already seeded.
import { fileURLToPath } from 'node:url';
import { pool, tx } from '../lib/db.js';
import { migrate } from './migrate.js';
import { generateChart } from '../modules/charts/service.js';

const POLICIES = [
  ['terms', 'Terms of Service', 'all', {}, `These Terms govern your use of the platform. The platform connects customers with independent, verified astrologers. Astrologers are responsible for the guidance they provide. You must be 18 or older to book consultations. Do not share abusive content. We may suspend accounts that violate these terms. [DRAFT — to be reviewed by qualified counsel before launch.]`],
  ['privacy', 'Privacy Notice', 'all', {}, `We collect your contact details, birth details (date, time and place of birth), consultation messages and payment references to provide consultations. Birth details are shared only with the astrologer assigned to your accepted consultation, and every access is logged. We never store your card details; payments are handled by our payment gateway. You may export your data or request deletion from your profile. [DRAFT — to be reviewed by qualified counsel against applicable Indian data-protection law.]`],
  ['astrology_disclaimer', 'Astrology Disclaimer', 'customers', {}, `Astrological consultations are for guidance and entertainment purposes. They are not a substitute for professional medical, legal, financial or psychological advice. Do not make decisions about health, safety, finances or legal matters solely on the basis of a consultation. Chart calculations depend on the accuracy of the birth details you provide.`],
  ['cancellation_policy', 'Cancellation & Refund Policy', 'customers', { fullRefundHoursBefore: 2, lateCancelRefundPct: 50 },
    `Billing: You authorize the full booked amount at checkout. You are charged per started minute of the session, up to the booked duration; any unused amount is released after the session.\n\nCancellations: Requests not yet accepted can be cancelled free of charge. Scheduled sessions cancelled 2 or more hours before the start receive a full release. Scheduled sessions cancelled within 2 hours of the start, and instant sessions cancelled after the astrologer accepts, incur a 50% cancellation fee.\n\nIf the astrologer declines, does not respond in time, cancels, or does not start the session, you are not charged.\n\nDisputes: Raise a support ticket within 7 days of the session for review.`],
  ['astrologer_agreement', 'Astrologer Partner Agreement', 'astrologers', {}, `As a partner astrologer you agree to provide honest guidance, keep client information confidential, use client birth details only for the assigned consultation, avoid medical/legal/financial directives, and follow platform conduct rules. Earnings are paid per the commission schedule after a hold period. [DRAFT — to be reviewed by qualified counsel.]`],
  ['ai_disclaimer', 'Automated Assistant Notice', 'all', {}, `The in-app assistant is automated. It answers app and support questions from approved help content and looks up your live booking and payment status. It does not provide astrological predictions and may hand your query to a human support agent.`],
];

const FAQS = [
  ['How do I book a consultation?', 'Open Astrologers, choose an astrologer, then tap "Chat now" for an instant session (when they are online) or pick a time slot to schedule. Review the price and cancellation terms, then pay securely.', ['book', 'booking', 'consultation', 'schedule', 'appointment'], 'customers', '/astrologers'],
  ['How am I charged?', 'You authorize the booked amount at checkout. You are charged only for the minutes used (per started minute), up to the booked duration. Unused amount is released automatically after the session.', ['charged', 'billing', 'minute', 'price', 'deducted', 'charge'], 'customers', null],
  ['How do refunds work?', 'If an astrologer declines or does not respond, the full amount is released. Cancellations follow our Cancellation & Refund Policy. Refunds return to your original payment method, usually within 5–7 business days depending on your bank.', ['refund', 'money', 'back', 'cancel', 'cancellation'], 'customers', '/support'],
  ['Why do you need my birth time and place?', 'Your birth date, time and place are used to calculate your birth chart (kundli). An accurate time matters for the ascendant and houses. If you do not know your time exactly, mark it as approximate or unknown and we will show a warning.', ['birth', 'time', 'place', 'kundli', 'chart', 'details'], 'customers', '/profile'],
  ['Who can see my birth chart?', 'Only you, and the astrologer assigned to a consultation you booked while that consultation is active. Every access is logged.', ['privacy', 'chart', 'see', 'share', 'birth', 'who'], 'customers', null],
  ['How do I update my birth details?', 'Go to Profile → Birth profiles and edit. If you change the date, time or place, your old chart is marked out of date and you can regenerate it.', ['update', 'edit', 'change', 'birth', 'details', 'profile'], 'customers', '/profile'],
  ['How do I delete my account or export my data?', 'Go to Profile → Privacy. You can download your data or submit a deletion request; our team will confirm within 72 hours.', ['delete', 'account', 'export', 'data', 'privacy'], 'customers', '/profile'],
  ['How do I get verified?', 'Complete your profile (bio, languages, specialties, rates), upload a government ID, and submit for verification. Our team reviews submissions, usually within 2 business days.', ['verify', 'verification', 'approved', 'approval', 'documents', 'onboarding'], 'astrologers', '/profile'],
  ['When do I get paid?', 'Earnings become eligible after a 7-day hold and are paid in payout batches once your eligible balance reaches ₹500 and your bank details are on file.', ['payout', 'paid', 'earnings', 'payment', 'bank', 'withdraw'], 'astrologers', '/earnings'],
  ['How do I see the client chart during a session?', 'Open the consultation and tap the Birth Chart button. On desktop the chart stays beside the chat; on mobile switch between Chat and Birth Chart tabs — the session and timer keep running.', ['chart', 'client', 'birth', 'session', 'kundli', 'view'], 'astrologers', null],
];

const ASTROLOGERS = [
  ['Acharya Raghav Sharma', '+919800000001', 18, ['Hindi', 'English', 'Sanskrit'], ['Vedic', 'Career', 'Marriage', 'Kundli Matching'], 3000,
    'Third-generation Vedic astrologer from Varanasi with 18 years of practice. Focus on career timing using Vimshottari dasha, marriage compatibility and practical, grounded guidance.'],
  ['Dr. Meera Iyer', '+919800000002', 12, ['English', 'Tamil', 'Malayalam'], ['Vedic', 'Health', 'Education', 'Nakshatra'], 2500,
    'Jyotish practitioner and researcher trained in the Parashari tradition. Known for clear explanations of nakshatras and planetary periods, especially for education and life transitions.'],
  ['Pandit Arjun Joshi', '+919800000003', 25, ['Hindi', 'Gujarati', 'Marathi'], ['Vedic', 'Finance', 'Business', 'Muhurta'], 4500,
    'Senior astrologer specialising in business and finance timing, muhurta selection and annual forecasts. Practising since 1999 in Ahmedabad.'],
  ['Sana Kapoor', '+919800000004', 7, ['English', 'Hindi', 'Punjabi'], ['Western', 'Relationships', 'Tarot', 'Career'], 1800,
    'Combines Vedic and Western techniques to offer empathetic relationship and career guidance. Certified tarot reader with seven years of consultations.'],
  ['Jyotishi Kavya Rao', '+919800000005', 9, ['Telugu', 'Kannada', 'English'], ['Vedic', 'Marriage', 'Family', 'Remedies'], 2200,
    'Family and marriage consultations rooted in classical Jyotish, with practical, non-fear-based suggestions. Based in Hyderabad.'],
];

export async function seed() {
  await migrate({ quiet: true });
  const existing = await pool.query(`SELECT 1 FROM user_accounts WHERE email = 'admin@astro.local'`);
  if (existing.rowCount) {
    console.log('Already seeded — skipping.');
    return;
  }
  await tx(async (t) => {
    for (const [type, title, audience, cfg, body] of POLICIES) {
      await t.query(`INSERT INTO policy_documents (notice_type, version, title, body, audience, config, is_current) VALUES ($1,1,$2,$3,$4,$5,true)`,
        [type, title, body, audience, cfg]);
    }
    for (const [i, [q, a, kw, aud, link]] of FAQS.entries()) {
      await t.query('INSERT INTO faqs (question, answer, keywords, audience, link, sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [q, a, kw, aud, link, i]);
    }
    await t.query(`INSERT INTO commission_rules (scope, platform_fee_bps, note) VALUES ('default', 3000, 'Launch default: 30% platform fee')`);

    const admins = [['admin@astro.local', 'Super Admin', 'super_admin'], ['support@astro.local', 'Support Agent', 'support'],
      ['finance@astro.local', 'Finance Officer', 'finance'], ['content@astro.local', 'Content Manager', 'content']];
    for (const [email, name, role] of admins) {
      await t.query(`INSERT INTO user_accounts (role, admin_role, email, display_name) VALUES ('admin',$1,$2,$3)`, [role, email, name]);
    }

    for (const [name, phone, exp, langs, specs, rate, bio] of ASTROLOGERS) {
      const u = await t.one(`INSERT INTO user_accounts (role, phone, display_name) VALUES ('astrologer',$1,$2) RETURNING user_id`, [phone, name]);
      const a = await t.one(
        `INSERT INTO astrologer_profiles (user_id, display_name, bio, experience_years, languages, specialties, services, modes, chat_rate_paise,
           voice_rate_paise, verification_status, verified_at, is_online, payout_details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'{chat,voice}',$8,$9,'approved',now(),true,$10) RETURNING astrologer_id`,
        [u.user_id, name, bio, exp, langs, specs, ['Birth chart reading', 'Dasha analysis', 'Question (prashna)'], rate, Math.round(rate * 1.3),
         { accountHolder: name, accountNumber: '123456789012', ifsc: 'HDFC0001234', verified: true }],
      );
      for (const type of ['terms', 'privacy', 'astrologer_agreement']) {
        await t.query(`INSERT INTO consent_records (user_id, notice_type, notice_version, context) VALUES ($1,$2,1,'seed')`, [u.user_id, type]);
      }
      // Availability: next 7 days, 10:00–13:00 and 17:00–20:00 IST, 30-minute slots
      for (let d = 1; d <= 7; d++) {
        for (const [h0, h1] of [[10, 13], [17, 20]]) {
          for (let h = h0; h < h1; h += 0.5) {
            const day = new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
            const start = new Date(`${day}T${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}:00+05:30`);
            await t.query(`INSERT INTO availability_slots (astrologer_id, start_at, end_at, time_zone) VALUES ($1,$2,$3,'Asia/Kolkata')`,
              [a.astrologer_id, start, new Date(start.getTime() + 30 * 60000)]);
          }
        }
      }
    }
    // One astrologer awaiting verification, to exercise the admin workflow
    const pu = await t.one(`INSERT INTO user_accounts (role, phone, display_name) VALUES ('astrologer','+919800000009','Rohan Mehta') RETURNING user_id`);
    await t.query(`INSERT INTO astrologer_profiles (user_id, display_name, bio, experience_years, languages, specialties, chat_rate_paise, verification_status)
      VALUES ($1,'Rohan Mehta','KP system and Vedic astrologer focusing on precise event timing for career and property questions. Five years of consultations.',5,'{English,Hindi}','{KP System,Career,Property}',2000,'submitted')`, [pu.user_id]);

    // Demo customer with a saved birth profile + chart
    const cu = await t.one(`INSERT INTO user_accounts (role, phone, display_name) VALUES ('customer','+919900000001','Priya Verma') RETURNING user_id`);
    const cp = await t.one(`INSERT INTO client_profiles (user_id, full_name, gender, contact_phone) VALUES ($1,'Priya Verma','female','+919900000001') RETURNING client_id`, [cu.user_id]);
    for (const type of ['terms', 'privacy', 'astrology_disclaimer']) {
      await t.query(`INSERT INTO consent_records (user_id, notice_type, notice_version, context) VALUES ($1,$2,1,'seed')`, [cu.user_id, type]);
    }
    const bp = await t.one(
      `INSERT INTO birth_profiles (client_id, label, full_name, gender, birth_date, birth_time, time_accuracy, time_source, place_name, latitude, longitude,
         tz_name, tz_offset_minutes, place_confirmed, is_primary)
       VALUES ($1,'Self','Priya Verma','female','1994-08-21','06:45:00','exact','Birth certificate','Pune, Maharashtra, India',18.5204,73.8567,'Asia/Kolkata',330,true,true) RETURNING *`,
      [cp.client_id],
    );
    await t.query(`INSERT INTO birth_profile_versions (birth_profile_id, version, snapshot) VALUES ($1,1,$2)`, [bp.birth_profile_id, { seeded: true }]);
    await generateChart(t, bp, {});

    await t.query(`INSERT INTO announcements (kind, title, body, audience, status, published_at) VALUES
      ('banner','Welcome to the platform','Your first 5 minutes with any astrologer are on us during launch week (demo banner).','customers','published',now()),
      ('announcement','Payout schedule','Payout batches run every Monday for eligible balances above ₹500.','astrologers','published',now())`);
  });
  console.log(`Seeded.
  Admin logins (OTP, email):  admin@astro.local (super admin), support@astro.local, finance@astro.local, content@astro.local
  Astrologer logins (phone):  +919800000001 … +919800000005 (approved), +919800000009 (awaiting verification)
  Customer login (phone):     +919900000001
  In development the OTP code is shown in the API response/app and logged by the server.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seed();
  await pool.end();
}
