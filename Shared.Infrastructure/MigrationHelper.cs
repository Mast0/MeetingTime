using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;

namespace Shared.Infrastructure;

/// <summary>
/// Handles the tricky EnsureCreated→MigrateAsync transition.
///
/// When a database was first created with EnsureCreated() all tables exist
/// but __EFMigrationsHistory is empty. Calling MigrateAsync() then tries to
/// re-create every table from Init onward and fails with 42P07.
///
/// This helper detects that state and marks pre-existing migrations as applied
/// (via INSERT ON CONFLICT DO NOTHING) so only genuinely new migrations run.
/// </summary>
public static class MigrationHelper
{
    public static async Task SyncAndMigrateAsync(MeetingTimeContext db)
    {
        var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();

        try
        {
            using var cmd = conn.CreateCommand();

            // 1. Ensure __EFMigrationsHistory exists (idempotent)
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                    "MigrationId"    character varying(150) NOT NULL,
                    "ProductVersion" character varying(32)  NOT NULL,
                    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
                );
                """;
            await cmd.ExecuteNonQueryAsync();

            // 2. Check if the DB already has a well-known table (EnsureCreated legacy)
            cmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables " +
                              "WHERE table_schema='public' AND table_name='AspNetRoles'";
            var tablesExist = Convert.ToInt64(await cmd.ExecuteScalarAsync()) > 0;
            if (!tablesExist)
            {
                // Fresh DB — let MigrateAsync create everything from scratch
                await conn.CloseAsync();
                await db.Database.MigrateAsync();
                return;
            }

            // 3. Read which migrations are already recorded
            cmd.CommandText = "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\"";
            var applied = new HashSet<string>(StringComparer.Ordinal);
            using (var reader = await cmd.ExecuteReaderAsync())
                while (await reader.ReadAsync())
                    applied.Add(reader.GetString(0));

            // 4. For each known migration not yet in history, decide what to do
            var allMigrations = db.Database.GetMigrations().ToList();
            foreach (var migrationId in allMigrations)
            {
                if (applied.Contains(migrationId)) continue;

                // Special-case: RemoveMaxParticipants — only fake-apply if the
                // column is already gone; otherwise let MigrateAsync run it for real.
                if (migrationId.Contains("RemoveMaxParticipants", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM information_schema.columns " +
                                      "WHERE table_name='Rooms' AND column_name='MaxParticipiants'";
                    var colExists = Convert.ToInt64(await cmd.ExecuteScalarAsync()) > 0;
                    if (colExists) continue; // Real migration needs to run — skip fake-apply
                }

                // All other unapplied migrations: mark as applied (tables already exist)
                using var ins = conn.CreateCommand();
                ins.CommandText = $"INSERT INTO \"__EFMigrationsHistory\" " +
                                  $"(\"MigrationId\", \"ProductVersion\") " +
                                  $"VALUES ('{migrationId}', '8.0.16') " +
                                  $"ON CONFLICT DO NOTHING";
                await ins.ExecuteNonQueryAsync();
            }
        }
        finally
        {
            if (conn.State != System.Data.ConnectionState.Closed)
                await conn.CloseAsync();
        }

        // 5. MigrateAsync now only sees truly pending migrations
        await db.Database.MigrateAsync();
    }
}
