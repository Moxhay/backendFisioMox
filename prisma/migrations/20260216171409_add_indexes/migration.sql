-- CreateIndex
CREATE INDEX "appointments_physioId_idx" ON "appointments"("physioId");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_dateTime_idx" ON "appointments"("dateTime");

-- CreateIndex
CREATE INDEX "appointments_physioId_dateTime_idx" ON "appointments"("physioId", "dateTime");

-- CreateIndex
CREATE INDEX "schedule_exceptions_physioId_idx" ON "schedule_exceptions"("physioId");

-- CreateIndex
CREATE INDEX "schedule_exceptions_physioId_date_idx" ON "schedule_exceptions"("physioId", "date");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "work_schedules_physioId_idx" ON "work_schedules"("physioId");
