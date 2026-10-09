-- Unknown ages stay null; existing ages and the positive-age constraint are preserved.
begin;
alter table public.competitors alter column age drop not null;
commit;
