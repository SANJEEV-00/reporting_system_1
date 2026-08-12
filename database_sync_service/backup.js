const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runBackup() {
  console.log("Starting cloud database backup...");
  
  try {
    // 1. Backup project table
    console.log("Backing up daily tasks (project table)...");
    const { data: tasks, error: tError } = await supabase.from('project').select('*');
    if (tError) throw tError;
    fs.writeFileSync(
      path.join(__dirname, 'project_backup.json'), 
      JSON.stringify(tasks, null, 2), 
      'utf8'
    );
    console.log(`Saved ${tasks.length} daily task reports to project_backup.json`);

    // 2. Backup profiles table
    console.log("Backing up profiles table...");
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) throw pError;
    fs.writeFileSync(
      path.join(__dirname, 'profiles_backup.json'), 
      JSON.stringify(profiles, null, 2), 
      'utf8'
    );
    console.log(`Saved ${profiles.length} user profiles to profiles_backup.json`);

    // 3. Backup projects table
    console.log("Backing up projects table...");
    const { data: projects, error: prError } = await supabase.from('projects').select('*');
    if (prError) throw prError;
    fs.writeFileSync(
      path.join(__dirname, 'projects_backup.json'), 
      JSON.stringify(projects, null, 2), 
      'utf8'
    );
    console.log(`Saved ${projects.length} projects to projects_backup.json`);

    console.log("Cloud backup completed successfully! All files saved in the current folder.");
  } catch (error) {
    console.error("Backup failed:", error.message);
  }
}

runBackup();
