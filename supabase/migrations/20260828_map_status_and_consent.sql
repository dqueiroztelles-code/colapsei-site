alter table public.contacts
  add column if not exists whatsapp_contact_consent boolean not null default false;

alter table public.contacts
  add column if not exists whatsapp_consented_at timestamptz;

alter table public.map_sessions
  add column if not exists owner_notification_status text not null default 'pending';

alter table public.map_sessions
  add column if not exists owner_notified_at timestamptz;

comment on column public.contacts.whatsapp_contact_consent is
  'Autorização opcional e específica para continuidade por WhatsApp.';
