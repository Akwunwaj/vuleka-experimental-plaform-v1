# ChatClan Backup And Restore Runbook

Use this runbook before launch and at least monthly during beta.

## Backup Objectives

- Database backup frequency: daily.
- Retention: 30 days.
- Restore drill: monthly.
- Store backups outside the application web root.
- Treat backup files as sensitive because they can contain customer data and encrypted integration tokens.

## Create A Database Backup

Set production `DB_*` environment variables, then run:

```powershell
npm run db:backup
```

By default this writes a SQL dump into `backups/`, which is ignored by git. To choose another destination:

```powershell
$env:DB_BACKUP_DIR = "D:\secure-chatclan-backups"
npm run db:backup
```

The backup includes table DDL and data for every table listed in `database/schema.sql`.

## Restore Drill

1. Create a separate restore-test MariaDB database.
2. Import the backup SQL into that restore-test database.
3. Point `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` at the restore-test database.
4. Run:

```powershell
npm run db:verify
```

5. Start the app against the restore-test database.
6. Run:

```powershell
npm run ops:startup-check
npm run smoke:beta
```

7. Record the restore date, backup filename, operator, and outcome in the operations log.

## POPIA Notes

- Data deletion requests redact active app records immediately.
- Infrastructure backups still need lifecycle enforcement from the hosting provider.
- Confirm DirectAdmin or hosting backups follow the 30-day retention policy and are purged after expiry.
- When responding to a deletion request, include active-app deletion status and backup-retention timing in the operator note.
