-- CreateIndex
CREATE UNIQUE INDEX "Appointment_active_vet_slot_key" ON "Appointment"("vetId", "scheduledAt") WHERE (status IN ('PENDING', 'CONFIRMED'));
