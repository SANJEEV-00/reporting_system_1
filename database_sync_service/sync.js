const { createClient } = require('@supabase/supabase-js');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Setup Logger
const logFilePath = path.join(__dirname, 'sync.log');
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFilePath, logMessage, 'utf8');
}

// Check configuration
const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SQL_SERVER_NAME', 'SQL_DATABASE_NAME'];
const missingEnv = requiredEnv.filter(name => !process.env[name]);
if (missingEnv.length > 0) {
  log(`CRITICAL ERROR: Missing configuration environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Initialize Supabase admin client (using service_role key to bypass RLS)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Configure SQL Server connection
const sqlConfig = {
  server: process.env.SQL_SERVER_NAME || 'localhost',
  port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : undefined,
  database: process.env.SQL_DATABASE_NAME,
  options: {
    instanceName: process.env.SQL_INSTANCE_NAME || undefined,
    trustServerCertificate: true // Required for local SQLEXPRESS ssl certs
  }
};


// Check for NTLM (Windows Authentication) config
if (process.env.SQL_AUTH_TYPE === 'ntlm') {
  sqlConfig.authentication = {
    type: 'ntlm',
    options: {
      domain: process.env.SQL_DOMAIN || 'WORKGROUP',
      userName: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD
    }
  };
} else if (process.env.SQL_USER) {
  // Fallback to standard SQL Server Authentication
  sqlConfig.user = process.env.SQL_USER;
  sqlConfig.password = process.env.SQL_PASSWORD;
}

async function runSync() {
  log('Starting Database Synchronization Task...');
  
  let pool = null;
  try {
    // 1. Connect to local SQL Server
    log('Connecting to local SQL Server (SSMS)...');
    pool = await sql.connect(sqlConfig);
    log('Connected to SQL Server successfully.');

    // Ensure local project table uses an IDENTITY auto-generating key (self-healing migration)
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND type in (N'U'))
      BEGIN
          -- If 'id' is not an IDENTITY column, drop the table (safe because it's empty) and recreate it correctly
          IF COLUMNPROPERTY(OBJECT_ID('dbo.project'), 'id', 'IsIdentity') = 0 OR COLUMNPROPERTY(OBJECT_ID('dbo.project'), 'id', 'IsIdentity') IS NULL
          BEGIN
              DROP TABLE [dbo].[project];
          END
      END

      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[project] (
              [id] INT IDENTITY(1,1) PRIMARY KEY,
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
      END
      ELSE
      BEGIN
          -- Make sure all Coil_Ref columns exist
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND name = N'Coil_Ref_1')
              ALTER TABLE [dbo].[project] ADD [Coil_Ref_1] NVARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND name = N'Coil_Ref_2')
              ALTER TABLE [dbo].[project] ADD [Coil_Ref_2] NVARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND name = N'Coil_Ref_3')
              ALTER TABLE [dbo].[project] ADD [Coil_Ref_3] NVARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[project]') AND name = N'Coil_Ref_4')
              ALTER TABLE [dbo].[project] ADD [Coil_Ref_4] NVARCHAR(100) NULL;
      END
    `);

    // 2. Synchronize profiles
    log('Fetching user profiles from Supabase...');
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) throw pError;
    log(`Fetched ${profiles.length} profiles. Syncing locally...`);
    
    for (const profile of profiles) {
      await pool.request()
        .input('id', sql.UniqueIdentifier, profile.id)
        .input('employee_id', sql.NVarChar(100), profile.employee_id)
        .input('name', sql.NVarChar(255), profile.name)
        .input('email', sql.NVarChar(255), profile.email)
        .input('role', sql.NVarChar(50), profile.role)
        .input('department', sql.NVarChar(150), profile.department)
        .input('designation', sql.NVarChar(150), profile.designation)
        .input('status', sql.NVarChar(50), profile.status || null)
        .input('created_at', sql.DateTimeOffset, new Date(profile.created_at))
        .input('updated_at', sql.DateTimeOffset, new Date(profile.updated_at))
        .query(`
          MERGE INTO profiles AS target
          USING (SELECT @id, @employee_id, @name, @email, @role, @department, @designation, @status, @created_at, @updated_at) AS source 
                (id, employee_id, name, email, role, department, designation, status, created_at, updated_at)
          ON target.id = source.id
          WHEN MATCHED THEN
              UPDATE SET employee_id = source.employee_id, name = source.name, email = source.email, 
                         role = source.role, department = source.department, designation = source.designation, 
                         status = source.status, updated_at = source.updated_at
          WHEN NOT MATCHED THEN
              INSERT (id, employee_id, name, email, role, department, designation, status, created_at, updated_at)
              VALUES (source.id, source.employee_id, source.name, source.email, source.role, source.department, source.designation, source.status, source.created_at, source.updated_at);
        `);
    }
    log('User profiles synchronized.');

    // 3. Synchronize projects list
    log('Fetching projects from Supabase...');
    const { data: projects, error: prError } = await supabase.from('projects').select('*');
    if (prError) throw prError;
    log(`Fetched ${projects.length} projects. Syncing locally...`);

    for (const project of projects) {
      await pool.request()
        .input('projectid', sql.NVarChar(100), project.projectid)
        .input('projectname', sql.NVarChar(255), project.projectname)
        .input('customername', sql.NVarChar(255), project.customername || null)
        .input('department', sql.NVarChar(150), project.department)
        .input('status', sql.NVarChar(50), project.status)
        .query(`
          MERGE INTO projects AS target
          USING (SELECT @projectid, @projectname, @customername, @department, @status) AS source 
                (projectid, projectname, customername, department, status)
          ON target.projectid = source.projectid
          WHEN MATCHED THEN
              UPDATE SET projectname = source.projectname, customername = source.customername, 
                         department = source.department, status = source.status
          WHEN NOT MATCHED THEN
              INSERT (projectid, projectname, customername, department, status)
              VALUES (source.projectid, source.projectname, source.customername, source.department, source.status);
        `);
    }
    log('Projects list synchronized.');

    // 4. Fetch daily tasks older than N retention days for archiving
    const retentionDays = parseInt(process.env.SYNC_RETENTION_DAYS || '30', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    log(`Checking for daily tasks older than ${retentionDays} days (Before: ${cutoffStr})...`);
    
    const { data: tasks, error: tError } = await supabase
      .from('project')
      .select('*')
      .lt('date', cutoffStr);
      
    if (tError) throw tError;

    if (tasks.length === 0) {
      log('No daily tasks found requiring archiving.');
    } else {
      log(`Found ${tasks.length} tasks to archive. Starting local transaction...`);

      // 5. Insert tasks into local SQL Server database using a transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        for (const task of tasks) {
          const request = new sql.Request(transaction);
          await request
            .input('employee_ID', sql.NVarChar(100), task.employee_ID)
            .input('Department', sql.NVarChar(150), task.Department)
            .input('Project_name', sql.NVarChar(255), task.Project_name)
            .input('Project_Id', sql.NVarChar(100), task.Project_Id)
            .input('Task', sql.NVarChar(sql.MAX), task.Task)
            .input('date', sql.Date, new Date(task.date))
            .input('duration', sql.NVarChar(50), task.duration)
            .input('Coil_Ref_1', sql.NVarChar(100), task.Coil_Ref_1 || task.coilRef1 || null)
            .input('Coil_Ref_2', sql.NVarChar(100), task.Coil_Ref_2 || task.coilRef2 || null)
            .input('Coil_Ref_3', sql.NVarChar(100), task.Coil_Ref_3 || task.coilRef3 || null)
            .input('Coil_Ref_4', sql.NVarChar(100), task.Coil_Ref_4 || task.coilRef4 || null)
            .input('created_at', sql.DateTimeOffset, task.created_at ? new Date(task.created_at) : new Date())
            .query(`
              IF NOT EXISTS (
                  SELECT 1 FROM [dbo].[project] 
                  WHERE employee_ID = @employee_ID 
                    AND date = @date 
                    AND Project_Id = @Project_Id 
                    AND Task = @Task
              )
              BEGIN
                  INSERT INTO [dbo].[project] (employee_ID, Department, Project_name, Project_Id, Task, date, duration, Coil_Ref_1, Coil_Ref_2, Coil_Ref_3, Coil_Ref_4, created_at)
                  VALUES (@employee_ID, @Department, @Project_name, @Project_Id, @Task, @date, @duration, @Coil_Ref_1, @Coil_Ref_2, @Coil_Ref_3, @Coil_Ref_4, @created_at);
              END
            `);
        }

        // Commit transaction locally
        await transaction.commit();
        log('Local transaction committed. Tasks archived in local database successfully.');

        // 6. Delete those archived tasks from Supabase cloud
        log('Deleting archived tasks from Supabase cloud...');
        const deletePromises = tasks.map(task => 
          supabase
            .from('project')
            .delete()
            .eq('employee_ID', task.employee_ID)
            .eq('date', task.date)
            .eq('Project_Id', task.Project_Id)
            .eq('Task', task.Task)
            .then(({ error }) => { if (error) throw error; })
        );
        
        // Execute in parallel batches of 20 to avoid rate limits
        const deleteBatchSize = 20;
        for (let i = 0; i < deletePromises.length; i += deleteBatchSize) {
          const batch = deletePromises.slice(i, i + deleteBatchSize);
          await Promise.all(batch);
        }

        log(`Successfully archived and deleted ${tasks.length} tasks from Supabase.`);
      } catch (txError) {
        // Rollback local transaction on failure
        log(`ERROR inside local transaction, rolling back: ${txError.message}`);
        await transaction.rollback();
        throw txError;
      }
    }

    log('Database Synchronization Task Completed Successfully.');
  } catch (err) {
    log(`SYNC TASK FAILED: ${err.message}`);
  } finally {
    if (pool) {
      await pool.close();
      log('Closed SQL Server connection.');
    }
  }
}

// Periodic execution or manual single run
if (require.main === module) {
  const express = require('express');
  const cors = require('cors');
  const nodemailer = require('nodemailer');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use('/public', express.static(path.join(__dirname, 'public')));

  app.post('/api/send-consolidated-report', async (req, res) => {
    const { recipients, date, pdfBase64, subject, body } = req.body;

    if (!recipients || !pdfBase64) {
      return res.status(400).json({ error: 'Recipients list and PDF data are required.' });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (!smtpHost || !smtpUser || !smtpPass) {
      log('SMTP Configuration is missing in .env');
      return res.status(500).json({ error: 'SMTP configuration is not set up on this server laptop. Please add SMTP details to .env' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: smtpUser,
        to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
        subject: subject || `Yesterday's Consolidated Work Report (${date || new Date().toISOString().split('T')[0]})`,
        text: body || `Please find yesterday's daily consolidated task report attached as a PDF file.`,
        attachments: [
          {
            filename: `Consolidated_Daily_Report_${date || new Date().toISOString().split('T')[0]}.pdf`,
            content: pdfBase64,
            encoding: 'base64'
          }
        ]
      };

      log(`Sending consolidated email to ${mailOptions.to}...`);
      await transporter.sendMail(mailOptions);
      log('Consolidated report email sent successfully!');

      return res.status(200).json({ success: true, message: 'Email sent successfully!' });
    } catch (mailError) {
      log(`Failed to send email: ${mailError.message}`);
      return res.status(500).json({ error: `Failed to send email: ${mailError.message}` });
    }
  });

  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    const jspdfSrc = path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
    const jspdfDest = path.join(publicDir, 'jspdf.umd.min.js');
    if (fs.existsSync(jspdfSrc)) {
      fs.copyFileSync(jspdfSrc, jspdfDest);
      log('Copied jspdf.umd.min.js to public directory.');
    } else {
      log(`Warning: jspdf.umd.min.js not found at ${jspdfSrc}`);
    }

    const autotableSrc = path.join(__dirname, '..', 'node_modules', 'jspdf-autotable', 'dist', 'jspdf.plugin.autotable.min.js');
    const autotableDest = path.join(publicDir, 'jspdf.plugin.autotable.min.js');
    if (fs.existsSync(autotableSrc)) {
      fs.copyFileSync(autotableSrc, autotableDest);
      log('Copied jspdf.plugin.autotable.min.js to public directory.');
    } else {
      log(`Warning: jspdf.plugin.autotable.min.js not found at ${autotableSrc}`);
    }
  } catch (copyErr) {
    log(`Error copying library files: ${copyErr.message}`);
  }

  app.use('/public', express.static(publicDir));

  const apiPort = 8001;
  app.listen(apiPort, '0.0.0.0', () => {
    log(`Local API Server listening on port ${apiPort} (supporting direct emailing)`);
  });

  const intervalHours = parseFloat(process.env.SYNC_INTERVAL_HOURS || '24');
  
  // Initial run
  runSync();
  
  // Set interval timer
  log(`Sync timer scheduled to run every ${intervalHours} hours.`);
  setInterval(runSync, intervalHours * 60 * 60 * 1000);
}

module.exports = runSync;
