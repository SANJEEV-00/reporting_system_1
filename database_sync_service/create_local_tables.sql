-- SQL Server Table Creation Script
-- Run this in SQL Server Management Studio (SSMS) on your local database (e.g. create a database named 'ReportingSystemArchive').

-- 1. Create profiles table (User details)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[profiles]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[profiles] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY,
        [employee_id] NVARCHAR(100) UNIQUE NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [email] NVARCHAR(255) NOT NULL,
        [role] NVARCHAR(50) NOT NULL,
        [department] NVARCHAR(150) NOT NULL,
        [designation] NVARCHAR(150) NOT NULL,
        [status] NVARCHAR(50) NULL,
        [created_at] DATETIMEOFFSET NOT NULL,
        [updated_at] DATETIMEOFFSET NOT NULL
    );
END;

-- 2. Create projects table (Project configuration details)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[projects]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[projects] (
        [projectid] NVARCHAR(100) PRIMARY KEY,
        [projectname] NVARCHAR(255) NOT NULL,
        [customername] NVARCHAR(255) NULL,
        [department] NVARCHAR(150) NOT NULL,
        [status] NVARCHAR(50) NOT NULL
    );
END;

-- 3. Create project table (Daily task submissions)
-- Note: Named 'project' to match the Supabase table name.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project] (
        [id] BIGINT PRIMARY KEY, -- Retain Supabase's generated ID to maintain reference integrity
        [employee_ID] NVARCHAR(100) NOT NULL,
        [Department] NVARCHAR(150) NOT NULL,
        [Project_name] NVARCHAR(255) NOT NULL,
        [Project_Id] NVARCHAR(100) NOT NULL,
        [Task] NVARCHAR(MAX) NOT NULL,
        [date] DATE NOT NULL,
        [duration] NVARCHAR(50) NOT NULL,
        [Coil_Ref_1] NVARCHAR(100) NULL,
        [Coil_Ref_2] NVARCHAR(100) NULL,
        [Coil_Ref_3] NVARCHAR(100) NULL,
        [Coil_Ref_4] NVARCHAR(100) NULL,
        [created_at] DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END;

-- Ensure columns exist in project table if table was already created
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND type in (N'U'))
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND name = N'Coil_Ref_1')
    BEGIN
        ALTER TABLE [dbo].[project] ADD [Coil_Ref_1] NVARCHAR(100) NULL;
        ALTER TABLE [dbo].[project] ADD [Coil_Ref_2] NVARCHAR(100) NULL;
        ALTER TABLE [dbo].[project] ADD [Coil_Ref_3] NVARCHAR(100) NULL;
        ALTER TABLE [dbo].[project] ADD [Coil_Ref_4] NVARCHAR(100) NULL;
    END;
END;

