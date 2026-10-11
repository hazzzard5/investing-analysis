alter table theses add column candidates int not null default 15 check (candidates >= 1 and candidates <= 40);
