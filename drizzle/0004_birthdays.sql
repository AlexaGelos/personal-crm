ALTER TABLE "contacts" ADD COLUMN "birth_day" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_month" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_year" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_date_pair" CHECK (("contacts"."birth_day" is null) = ("contacts"."birth_month" is null));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_year_needs_date" CHECK ("contacts"."birth_year" is null or "contacts"."birth_day" is not null);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_month_range" CHECK ("contacts"."birth_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_day_range" CHECK ("contacts"."birth_day" between 1 and case "contacts"."birth_month" when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_year_range" CHECK ("contacts"."birth_year" between 1900 and 2200);