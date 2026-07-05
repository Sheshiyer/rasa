-- 0001_init.sql — Rasa v1 state store.
-- Canonical for Supabase (auth.users + auth.uid() are provided there). The pglite
-- test harness shims auth.uid() + an app_user role; see server/src/store/db.ts.

create table preference_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  diet_type            text not null check (diet_type in ('veg','jain','egg','nonveg')),
  cuisines_like        text[] not null default '{}',
  cuisines_avoid       text[] not null default '{}',
  allergens            text[] not null default '{}',            -- HARD constraint
  dislikes             text[] not null default '{}',
  spice_level          text not null check (spice_level in ('mild','medium','hot')),
  meals_per_day        int  not null check (meals_per_day between 1 and 6),
  slots                jsonb not null,
  delivery_address_id  text,
  budget_monthly_inr   int  not null check (budget_monthly_inr > 0),
  calorie_target       int  not null check (calorie_target > 0),
  macro_target         jsonb not null,
  variety_tolerance    text not null check (variety_tolerance in ('low','medium','high')),
  source_prefs         text[] not null default '{swiggy}',
  cheat_rules          jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table candidate_dishes (
  id                     uuid primary key default gen_random_uuid(),
  plan_run_id            uuid not null,
  source                 text not null default 'swiggy',
  restaurant_id          text not null,
  restaurant_name        text not null,
  dish_id                text not null,
  dish_name              text not null,
  description            text,
  price_inr              int not null,
  is_veg                 boolean not null,
  canonical_dish_id      text,
  macros                 jsonb,
  macro_confidence       text check (macro_confidence in ('high','low')),
  deliverable_to_address boolean not null default false,
  created_at             timestamptz not null default now()
);
create index candidate_dishes_plan_run_idx on candidate_dishes(plan_run_id);

create table plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null check (status in ('draft','approved','active','completed','cancelled')),
  start_date    date not null,
  end_date      date not null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index plans_user_idx on plans(user_id);

create table plan_entries (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references plans(id) on delete cascade,
  day               date not null,
  slot              text not null,
  chosen            jsonb not null,
  fallbacks         jsonb not null default '[]',
  slot_budget_inr   int not null,
  projected_macros  jsonb not null,
  slot_state        text not null default 'pending'
                    check (slot_state in ('pending','nudged','confirmed','ordered','declined','skipped','failed')),
  scheduled_wake_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (plan_id, day, slot)
);
create index plan_entries_wake_idx on plan_entries(slot_state, scheduled_wake_at);

create table spend_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  plan_id        uuid not null references plans(id) on delete cascade,
  plan_entry_id  uuid references plan_entries(id) on delete set null,
  day            date not null,
  slot           text not null,
  planned_inr    int not null,
  actual_inr     int,
  coupon_code    text,
  coupon_discount_inr int not null default 0,
  created_at     timestamptz not null default now()
);
create index spend_ledger_user_month_idx on spend_ledger(user_id, day);

create table order_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_entry_id     uuid references plan_entries(id) on delete set null,
  swiggy_order_id   text,
  restaurant_id     text not null,
  dish_id           text not null,
  dish_name         text not null,
  amount_inr        int not null,
  status            text not null,
  rating            int check (rating between 1 and 5),
  placed_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index order_history_user_idx on order_history(user_id);

create table nutrition_cache (
  canonical_dish_id text primary key,
  macros            jsonb not null,
  macro_confidence  text not null check (macro_confidence in ('high','low')),
  source            text not null,
  portion_g         numeric,
  created_at        timestamptz not null default now()
);

-- RLS: every user-scoped table restricts rows to the current user.
alter table preference_profiles enable row level security;
alter table plans               enable row level security;
alter table plan_entries        enable row level security;
alter table spend_ledger        enable row level security;
alter table order_history       enable row level security;

create policy own_profile on preference_profiles
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_plans on plans
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_ledger on spend_ledger
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_orders on order_history
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- plan_entries are scoped through their parent plan.
create policy own_plan_entries on plan_entries
  using (exists (select 1 from plans p where p.id = plan_entries.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from plans p where p.id = plan_entries.plan_id and p.user_id = auth.uid()));
