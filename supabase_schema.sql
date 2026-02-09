-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Courses table
create table courses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  code text,
  color text default '#3b82f6',
  credit integer default 3,
  syllabus jsonb default '[]'::jsonb,
  attendance_limit integer default 14,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Study Sessions table
create table study_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  course_id uuid references courses on delete set null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  duration integer, -- in seconds
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Assignments/Events table
create table assignments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  course_id uuid references courses on delete cascade,
  title text not null,
  type text check (type in ('exam', 'homework', 'project', 'quiz', 'other')),
  due_date timestamp with time zone,
  is_completed boolean default false,
  grade float,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS Policies (Row Level Security)
alter table profiles enable row level security;
alter table courses enable row level security;
alter table study_sessions enable row level security;
alter table assignments enable row level security;

-- Profiles policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Courses policies
create policy "Users can view own courses" on courses for select using (auth.uid() = user_id);
create policy "Users can insert own courses" on courses for insert with check (auth.uid() = user_id);
create policy "Users can update own courses" on courses for update using (auth.uid() = user_id);
create policy "Users can delete own courses" on courses for delete using (auth.uid() = user_id);

-- Study Sessions policies
create policy "Users can view own sessions" on study_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on study_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on study_sessions for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" on study_sessions for delete using (auth.uid() = user_id);

-- Assignments policies
create policy "Users can view own assignments" on assignments for select using (auth.uid() = user_id);
create policy "Users can insert own assignments" on assignments for insert with check (auth.uid() = user_id);
create policy "Users can update own assignments" on assignments for update using (auth.uid() = user_id);
create policy "Users can delete own assignments" on assignments for delete using (auth.uid() = user_id);

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
