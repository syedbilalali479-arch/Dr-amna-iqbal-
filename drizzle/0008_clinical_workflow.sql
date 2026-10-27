ALTER TABLE prescriptions ADD COLUMN appointment_id TEXT;
CREATE INDEX IF NOT EXISTS prescriptions_appointment_idx ON prescriptions(clinic_id, appointment_id);

UPDATE appointments SET doctor='Dr. Aamina Iqbal' WHERE doctor IN ('Dr. Amna Iqbal','Dr. Aamna Iqbal','Dr. Zoya Khan');
UPDATE prescriptions SET doctor='Dr. Aamina Iqbal' WHERE doctor IN ('Dr. Amna Iqbal','Dr. Aamna Iqbal','Dr. Zoya Khan');
UPDATE followups SET doctor='Dr. Aamina Iqbal' WHERE doctor IN ('Dr. Amna Iqbal','Dr. Aamna Iqbal','Dr. Zoya Khan');
UPDATE treatments SET assigned_doctors='Dr. Aamina Iqbal',availability='5:00 pm to 10:00 pm';
