import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Brand } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { CustomPicker } from '@/components/ui/custom-picker';

// In-memory cache to preserve form draft when navigating between screens
const draftCache: Record<string, { 
  description: string, 
  startTime: string, 
  endTime: string, 
  selectedProject: string,
  workOrderNo?: string,
  customCustomerName?: string,
  machineName?: string,
  coilRef1?: string,
  coilRef2?: string,
  coilRef3?: string,
  coilRef4?: string,
  durationHours?: string,
  durationMinutes?: string
}> = {};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const draft = user?.id ? draftCache[user.id] : null;

  const [description, setDescription] = useState(draft?.description || '');
  const [startTime, setStartTime] = useState(draft?.startTime || '08:30');
  const [endTime, setEndTime] = useState(draft?.endTime || '09:30');
  const [duration, setDuration] = useState('');
  const [durationHours, setDurationHours] = useState(draft?.durationHours || '01');
  const [durationMinutes, setDurationMinutes] = useState(draft?.durationMinutes || '00');
  const [isSaving, setIsSaving] = useState(false);

  const [departmentProjects, setDepartmentProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState(draft?.selectedProject || '');

  const [predefinedTasks, setPredefinedTasks] = useState<any[]>([]);

  // Custom fields for Service Year & Commissioning / Maintenance
  const [workOrderNo, setWorkOrderNo] = useState(draft?.workOrderNo || '');
  const [customCustomerName, setCustomCustomerName] = useState(draft?.customCustomerName || '');
  const [machineName, setMachineName] = useState(draft?.machineName || '');
  
  // Coil Reference Numbers for Fabrication
  const [coilRef1, setCoilRef1] = useState(draft?.coilRef1 || '');
  const [coilRef2, setCoilRef2] = useState(draft?.coilRef2 || '');
  const [coilRef3, setCoilRef3] = useState(draft?.coilRef3 || '');
  const [coilRef4, setCoilRef4] = useState(draft?.coilRef4 || '');
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Identify selected project characteristics
  const selectedProjObj = useMemo(() => {
    return departmentProjects.find(p => p.projectid === selectedProject);
  }, [selectedProject, departmentProjects]);

  const isServiceYear = useMemo(() => {
    if (!selectedProjObj) return false;
    const name = (selectedProjObj.projectname || '').toLowerCase();
    return name.includes('service year') || name.includes('commissioning') || name.includes('commisioning');
  }, [selectedProjObj]);

  const isMaintenance = useMemo(() => {
    if (!selectedProjObj) return false;
    const name = (selectedProjObj.projectname || '').toLowerCase();
    return name.includes('maintenance') || name.includes('maintanance');
  }, [selectedProjObj]);

  // Keep cache updated when draft changes
  useEffect(() => {
    if (user?.id) {
      draftCache[user.id] = { 
        description, 
        startTime, 
        endTime, 
        selectedProject, 
        workOrderNo, 
        customCustomerName, 
        machineName,
        coilRef1,
        coilRef2,
        coilRef3,
        coilRef4,
        durationHours,
        durationMinutes
      };
    }
  }, [description, startTime, endTime, selectedProject, workOrderNo, customCustomerName, machineName, coilRef1, coilRef2, coilRef3, coilRef4, durationHours, durationMinutes, user?.id]);

  const [dailyTasks, setDailyTasks] = useState<any[]>([]);

  useEffect(() => {
    const loadSavedTasks = async () => {
      if (user?.id) {
        try {
          const saved = await AsyncStorage.getItem(`@dailyTasks_${user.id}`);
          if (saved) {
            setDailyTasks(JSON.parse(saved));
          }
        } catch (err) {
          console.error("Failed to load saved tasks", err);
        }
      }
    };
    loadSavedTasks();
  }, [user?.id]);

  useEffect(() => {
    if (user?.department) {
      fetchProjects();
      fetchPredefinedTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'onGoing');
        
      if (error) throw error;
      setDepartmentProjects(data || []);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const fetchPredefinedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('predefined_tasks')
        .select('*')
        .eq('department', user?.department)
        .order('task_name', { ascending: true });
        
      if (error) throw error;
      setPredefinedTasks(data || []);
    } catch (err) {
      console.error("Failed to load predefined tasks", err);
    }
  };

  // Generate time options in 5-minute intervals
  const timeOptions = useMemo(() => {
    const times = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 5) {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        times.push(`${hh}:${mm}`);
      }
    }
    
    if (startTime && !times.includes(startTime)) {
      times.push(startTime);
      times.sort();
    }
    
    return times;
  }, [startTime]);

  const calculateEndTime = (start: string, hh: string, mm: string) => {
    if (!start || !start.includes(':')) return '';
    const [sh, sm] = start.split(':').map(Number);
    const h = Number(hh) || 0;
    const m = Number(mm) || 0;
    
    let totalMins = sh * 60 + sm + h * 60 + m;
    totalMins = totalMins % (24 * 60); // Wrap around 24 hours
    
    const eh = Math.floor(totalMins / 60);
    const em = totalMins % 60;
    
    return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
  };

  // Auto-calculate End Time and Duration when pickers change
  useEffect(() => {
    if (startTime) {
      const calculatedEnd = calculateEndTime(startTime, durationHours, durationMinutes);
      setEndTime(calculatedEnd);
      setDuration(`${durationHours.padStart(2, '0')}:${durationMinutes.padStart(2, '0')}`);
    } else {
      setEndTime('');
      setDuration('');
    }
  }, [startTime, durationHours, durationMinutes]);

  const handleAddTask = async () => {
    if (!user || !user.id || !user.employeeId) {
      alert('User not identified. Please login again.');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a task description');
      return;
    }
    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    // Custom validations (strictly required, no optional fields)
    if (isServiceYear) {
      if (!customCustomerName.trim()) {
        alert('Please enter a Customer Name');
        return;
      }
      if (!workOrderNo.trim()) {
        alert('Please enter a Work Order Number');
        return;
      }
    }
    if (isMaintenance) {
      if (!machineName.trim()) {
        alert('Please enter a Machine Name');
        return;
      }
    }

    // Coil Reference validation for Fabrication department
    const isFabrication = user?.department?.toLowerCase() === 'fabrication';
    const coilRefs = [coilRef1, coilRef2, coilRef3, coilRef4].map(c => c.trim()).filter(Boolean);

    if (isFabrication) {
      // 1. Check for local duplicates between inputs in the current form
      const formDuplicates = coilRefs.filter((item, index) => coilRefs.indexOf(item) !== index);
      if (formDuplicates.length > 0) {
        alert(`Duplicate entries: Coil reference number "${formDuplicates[0]}" was entered more than once in the form.`);
        return;
      }

      // 2. Check for duplicates against other tasks in the preview list
      for (let i = 0; i < dailyTasks.length; i++) {
        if (editingIndex === i) continue; // skip the one we are currently editing
        const otherTask = dailyTasks[i];
        const otherRefs = [otherTask.coilRef1, otherTask.coilRef2, otherTask.coilRef3, otherTask.coilRef4].map(c => c?.trim()).filter(Boolean);
        for (const ref of coilRefs) {
          if (otherRefs.includes(ref)) {
            alert(`Duplicate entry: Coil reference number "${ref}" is already added to another task in your preview list.`);
            return;
          }
        }
      }

      // 3. Query Supabase database to ensure uniqueness across the Fabrication department
      for (const ref of coilRefs) {
        const { data, error } = await supabase
          .from('project')
          .select('employee_ID, date')
          .eq('Department', 'Fabrication')
          .or(`Coil_Ref_1.eq."${ref}",Coil_Ref_2.eq."${ref}",Coil_Ref_3.eq."${ref}",Coil_Ref_4.eq."${ref}"`);

        if (error) {
          console.error("Coil unique validation failed:", error);
        } else if (data && data.length > 0) {
          alert(`Coil Reference No "${ref}" has already been entered in the Fabrication department.\n(Logged by Employee: ${data[0].employee_ID} on ${data[0].date})`);
          return;
        }
      }
    }

    if (!duration.trim()) {
      alert('Please enter a valid duration');
      return;
    }
    
    const selectedProjectObj = departmentProjects.find(p => p.projectid === selectedProject);
    const taskNameToSave = selectedProjectObj ? selectedProjectObj.projectname : 'Task';
    
    let descToSave = description;
    let coilRefDetails = '';
    if (isFabrication && coilRefs.length > 0) {
      const refsText = [coilRef1, coilRef2, coilRef3, coilRef4].map((r, i) => r.trim() ? `Coil Ref ${i+1}: ${r.trim()}` : '').filter(Boolean);
      coilRefDetails = `\n${refsText.join('\n')}`;
    }

    if (isServiceYear) {
      descToSave = `Project ID: ${selectedProjectObj?.projectid}\nWork Order No: ${workOrderNo.trim()}\nCustomer: ${customCustomerName.trim()}${coilRefDetails}\n\nTask:\n${description}`;
    } else if (isMaintenance) {
      descToSave = `Project ID: ${selectedProjectObj?.projectid}\nMachine Name: ${machineName.trim()}${coilRefDetails}\n\nTask:\n${description}`;
    } else if (selectedProjectObj) {
      descToSave = `Project ID: ${selectedProjectObj.projectid}\nCustomer: ${selectedProjectObj.customername}${coilRefDetails}\n\nTask:\n${description}`;
    }

    let hoursWorked = 0;
    if (duration.includes(':')) {
      const parts = duration.split(':');
      hoursWorked = parseInt(parts[0] || '0', 10) + (parseInt(parts[1] || '0', 10) / 60);
    } else {
      hoursWorked = parseFloat(duration);
    }

    if (isNaN(hoursWorked) || hoursWorked <= 0) {
      alert('Please enter a valid duration (e.g. 01:30 or 1.5)');
      return;
    }

    const newTask = {
      taskName: taskNameToSave,
      description: descToSave,
      duration: duration,
      hoursWorked: Number(hoursWorked.toFixed(2)),
      projectId: selectedProject,
      startTime,
      endTime,
      rawDescription: description,
      workOrderNo: isServiceYear ? workOrderNo.trim() : '',
      customCustomerName: isServiceYear ? customCustomerName.trim() : '',
      machineName: isMaintenance ? machineName.trim() : '',
      coilRef1: isFabrication ? coilRef1.trim() : '',
      coilRef2: isFabrication ? coilRef2.trim() : '',
      coilRef3: isFabrication ? coilRef3.trim() : '',
      coilRef4: isFabrication ? coilRef4.trim() : '',
    };

    let newTasks = [];
    if (editingIndex !== null) {
      newTasks = [...dailyTasks];
      newTasks[editingIndex] = newTask;
      setEditingIndex(null);
    } else {
      newTasks = [...dailyTasks, newTask];
    }
    
    setDailyTasks(newTasks);
    if (user?.id) {
      AsyncStorage.setItem(`@dailyTasks_${user.id}`, JSON.stringify(newTasks)).catch(err => console.error("Failed to save tasks", err));
    }

    // Reset form - start time defaults to the calculated end time of the task just added
    const nextStartTime = endTime || '08:30';
    const nextEndTime = calculateEndTime(nextStartTime, '01', '00');
    
    setDescription('');
    setStartTime(nextStartTime);
    setEndTime(nextEndTime);
    setDurationHours('01');
    setDurationMinutes('00');
    setDuration('01:00');
    setSelectedProject('');
    setWorkOrderNo('');
    setCustomCustomerName('');
    setMachineName('');
    setCoilRef1('');
    setCoilRef2('');
    setCoilRef3('');
    setCoilRef4('');

    // Save next draft cache defaults
    if (user?.id) {
      draftCache[user.id] = { 
        description: '', 
        startTime: nextStartTime, 
        endTime: nextEndTime, 
        selectedProject: '',
        workOrderNo: '',
        customCustomerName: '',
        machineName: '',
        coilRef1: '',
        coilRef2: '',
        coilRef3: '',
        coilRef4: '',
        durationHours: '01',
        durationMinutes: '00'
      };
    }
  };

  const handleEditTask = (index: number) => {
    const task = dailyTasks[index];
    setDescription(task.rawDescription || '');
    setStartTime(task.startTime || '08:30');
    setEndTime(task.endTime || '09:30');
    setDuration(task.duration || '01:00');

    // Parse duration to hours and minutes
    const dur = task.duration || '01:00';
    if (dur.includes(':')) {
      const [h, m] = dur.split(':');
      setDurationHours(h || '01');
      setDurationMinutes(m || '00');
    } else {
      setDurationHours('01');
      setDurationMinutes('00');
    }

    setSelectedProject(task.projectId || '');
    setWorkOrderNo(task.workOrderNo || '');
    setCustomCustomerName(task.customCustomerName || '');
    setMachineName(task.machineName || '');
    setCoilRef1(task.coilRef1 || '');
    setCoilRef2(task.coilRef2 || '');
    setCoilRef3(task.coilRef3 || '');
    setCoilRef4(task.coilRef4 || '');
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    setDescription('');
    
    // Set start time to the end time of the last task in the list (or '08:30' if list is empty)
    let lastEndTime = '08:30';
    if (dailyTasks.length > 0) {
      lastEndTime = dailyTasks[dailyTasks.length - 1].endTime || '08:30';
    }
    const nextEndTime = calculateEndTime(lastEndTime, '01', '00');

    setStartTime(lastEndTime);
    setEndTime(nextEndTime);
    setDurationHours('01');
    setDurationMinutes('00');
    setDuration('01:00');
    setSelectedProject('');
    setWorkOrderNo('');
    setCustomCustomerName('');
    setMachineName('');
    setCoilRef1('');
    setCoilRef2('');
    setCoilRef3('');
    setCoilRef4('');
    setEditingIndex(null);
  };

  const handleDeleteTask = (index: number) => {
    if (editingIndex === index) {
      handleCancelEdit();
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    const updatedTasks = dailyTasks.filter((_, i) => i !== index);
    setDailyTasks(updatedTasks);
    if (user?.id) {
      AsyncStorage.setItem(`@dailyTasks_${user.id}`, JSON.stringify(updatedTasks)).catch(err => console.error("Failed to save tasks", err));
    }

    // Adjust the start time of the input form to default to the end time of the new last task in the list (if we are not currently editing a task)
    if (editingIndex === null) {
      let lastEndTime = '08:30';
      if (updatedTasks.length > 0) {
        lastEndTime = updatedTasks[updatedTasks.length - 1].endTime || '08:30';
      }
      setStartTime(lastEndTime);
      setEndTime(calculateEndTime(lastEndTime, durationHours, durationMinutes));
    }
  };

  const handleSaveAll = async () => {
    if (dailyTasks.length === 0) {
      alert("No tasks to save. Please add a task first.");
      return;
    }
    
    setIsSaving(true);
    try {
      const inserts = dailyTasks.map(task => ({
        employee_ID: user?.employeeId,
        Department: user?.department,
        Project_name: task.taskName,
        Project_Id: task.projectId,
        Task: task.rawDescription,
        date: new Date().toISOString().split('T')[0],
        duration: task.duration,
        Coil_Ref_1: task.coilRef1 || null,
        Coil_Ref_2: task.coilRef2 || null,
        Coil_Ref_3: task.coilRef3 || null,
        Coil_Ref_4: task.coilRef4 || null
      }));

      const { error } = await supabase.from('project').insert(inserts);

      if (error) throw error;
      
      alert('All tasks saved successfully for today!');
      setDailyTasks([]);
      if (user?.id) {
        AsyncStorage.removeItem(`@dailyTasks_${user.id}`).catch(err => console.error("Failed to clear saved tasks", err));
      }
    } catch (err: any) {
      alert('Failed to save tasks: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;

  const renderFormFields = () => (
    <>
      {/* Top Row: Project & Customer */}
      <View style={[styles.fieldRowHorizontal, { zIndex: 2 }]}>
        <View style={styles.flexHalf}>
          <Text style={styles.label}>Project selection</Text>
          <View style={[styles.inputWrapper, { padding: 0 }]}>
            <CustomPicker
              selectedValue={selectedProject}
              onValueChange={(val) => {
                setSelectedProject(val);
                setWorkOrderNo('');
                setCustomCustomerName('');
                setMachineName('');
              }}
              style={styles.picker}
              placeholder="Select Project"
              items={departmentProjects.map(proj => ({
                label: `${proj.projectid} - ${proj.projectname}`,
                value: proj.projectid
              }))}
            />
          </View>
        </View>
        <View style={styles.flexHalf}>
          <Text style={styles.label}>customer</Text>
          {isServiceYear ? (
            <TextInput
              style={[styles.input, { backgroundColor: Brand.colors.white }]}
              placeholder="Enter Customer Name"
              placeholderTextColor="#9CA3AF"
              value={customCustomerName}
              onChangeText={setCustomCustomerName}
            />
          ) : (
            <TextInput
              style={[styles.input, { color: '#6B7280', backgroundColor: '#F3F4F6' }]}
              placeholder="Auto-filled"
              placeholderTextColor="#9CA3AF"
              value={selectedProjObj?.customername || ''}
              editable={false}
            />
          )}
        </View>
      </View>

      {/* Conditional Input Rows */}
      {isServiceYear && (
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Work Order Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Brand.colors.white }]}
            placeholder="Enter Work Order Number"
            placeholderTextColor="#9CA3AF"
            value={workOrderNo}
            onChangeText={setWorkOrderNo}
          />
        </View>
      )}

      {isMaintenance && (
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Machine Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Brand.colors.white }]}
            placeholder="Enter Machine Name"
            placeholderTextColor="#9CA3AF"
            value={machineName}
            onChangeText={setMachineName}
          />
        </View>
      )}

      {user?.department?.toLowerCase() === 'fabrication' && (
        <View style={styles.coilRefsSection}>
          <Text style={[styles.label, { marginBottom: 4 }]}>Coil Reference Numbers</Text>
          <View style={isDesktop ? styles.fieldRowHorizontal : styles.fieldRowVertical}>
            <View style={isDesktop ? styles.flexHalf : styles.flexFull}>
              <Text style={[styles.label, { fontSize: 12, color: '#4B5563' }]}>Coil Ref No 1</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Brand.colors.white }]}
                placeholder="Coil Ref 1"
                placeholderTextColor="#9CA3AF"
                value={coilRef1}
                onChangeText={setCoilRef1}
              />
            </View>
            <View style={isDesktop ? styles.flexHalf : styles.flexFull}>
              <Text style={[styles.label, { fontSize: 12, color: '#4B5563' }]}>Coil Ref No 2</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Brand.colors.white }]}
                placeholder="Coil Ref 2"
                placeholderTextColor="#9CA3AF"
                value={coilRef2}
                onChangeText={setCoilRef2}
              />
            </View>
          </View>
        </View>
      )}

      {/* Middle Row: Task Description */}
      <View style={styles.fieldRow}>
        <Text style={styles.label}>task Description</Text>
        {predefinedTasks.length > 0 ? (
          <View style={[styles.inputWrapper, { padding: 0 }]}>
            <CustomPicker
              selectedValue={description}
              onValueChange={setDescription}
              style={styles.picker}
              placeholder="Select Task Description"
              items={predefinedTasks.map((t) => ({
                label: t.task_name,
                value: t.task_name,
              }))}
            />
          </View>
        ) : (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter task description..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        )}
      </View>

      {/* Third Row: Times */}
      <View style={{ flexDirection: 'row', gap: 16, width: '100%', marginBottom: 16 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.label}>start time</Text>
          <View style={[styles.inputWrapper, { padding: 0 }]}>
            <CustomPicker
              selectedValue={startTime}
              onValueChange={(val) => setStartTime(val)}
              style={styles.picker}
              placeholder="Start Time"
              items={timeOptions.map(time => ({ label: time, value: time }))}
            />
          </View>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.label}>End Time</Text>
          <TextInput
            style={[styles.input, { color: '#6B7280', backgroundColor: '#F3F4F6' }]}
            placeholder="Auto-calculated"
            value={endTime}
            editable={false}
          />
        </View>
      </View>

      {/* Fourth Row: Duration */}
      <View style={{ gap: 8, width: '100%', marginBottom: 16 }}>
        <Text style={styles.label}>Duration</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={[styles.inputWrapper, { flex: 1, padding: 0 }]}>
            <CustomPicker
              selectedValue={durationHours}
              onValueChange={(val) => setDurationHours(val)}
              style={styles.picker}
              placeholder="Hours"
              items={[
                { label: '00 hr', value: '00' },
                { label: '01 hr', value: '01' },
                { label: '02 hr', value: '02' },
                { label: '03 hr', value: '03' },
                { label: '04 hr', value: '04' },
                { label: '05 hr', value: '05' },
                { label: '06 hr', value: '06' },
                { label: '07 hr', value: '07' },
                { label: '08 hr', value: '08' },
                { label: '09 hr', value: '09' },
                { label: '10 hr', value: '10' },
                { label: '11 hr', value: '11' },
                { label: '12 hr', value: '12' },
              ]}
            />
          </View>
          <View style={[styles.inputWrapper, { flex: 1, padding: 0 }]}>
            <CustomPicker
              selectedValue={durationMinutes}
              onValueChange={(val) => setDurationMinutes(val)}
              style={styles.picker}
              placeholder="Minutes"
              items={[
                { label: '00 min', value: '00' },
                { label: '05 min', value: '05' },
                { label: '10 min', value: '10' },
                { label: '15 min', value: '15' },
                { label: '20 min', value: '20' },
                { label: '25 min', value: '25' },
                { label: '30 min', value: '30' },
                { label: '35 min', value: '35' },
                { label: '40 min', value: '40' },
                { label: '45 min', value: '45' },
                { label: '50 min', value: '50' },
                { label: '55 min', value: '55' },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Action Buttons Row */}
      {isDesktop ? (
        <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
          {editingIndex !== null ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.addButton, { backgroundColor: '#10B981', borderColor: '#10B981' }]} onPress={handleAddTask}>
                <Text style={styles.addButtonText}>Update</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addButton, { backgroundColor: '#6B7280', borderColor: '#6B7280' }]} onPress={handleCancelEdit}>
                <Text style={styles.addButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
              <Text style={styles.addButtonText}>add</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.mobileAddBtnContainer}>
          {editingIndex !== null ? (
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity style={[styles.mobileAddBtn, { flex: 1, backgroundColor: '#10B981' }]} onPress={handleAddTask}>
                <Text style={styles.mobileAddBtnText}>Update Task</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mobileAddBtn, { flex: 1, backgroundColor: '#6B7280' }]} onPress={handleCancelEdit}>
                <Text style={styles.mobileAddBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.mobileAddBtn} onPress={handleAddTask}>
              <Text style={styles.mobileAddBtnText}>Add Task</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );

  const renderTableAndSubmit = () => (
    <>
      {/* Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'center' }]}>S.NO</Text>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Tasks</Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Duration</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>Actions</Text>
        </View>
        
        {dailyTasks.length === 0 ? (
          <View style={styles.emptyTable}>
            <Text style={styles.emptyTableText}>No tasks added yet.</Text>
          </View>
        ) : (
          dailyTasks.map((task, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'center' }]}>{index + 1}</Text>
              <View style={[styles.tableCell, { flex: 3, justifyContent: 'center' }]}>
                <Text style={{ fontSize: 14, color: '#1F2937' }}>
                  <Text style={{fontWeight: '600'}}>
                    {task.projectId ? `${task.projectId} - ${task.taskName}` : task.taskName}
                  </Text>: {task.rawDescription}
                </Text>
                {(task.coilRef1 || task.coilRef2 || task.coilRef3 || task.coilRef4) ? (
                  <Text style={{ fontSize: 12, color: '#0056FF', marginTop: 4, fontWeight: '600' }}>
                    Coils: {[task.coilRef1, task.coilRef2, task.coilRef3, task.coilRef4].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>{task.duration}</Text>
              <View style={[styles.tableCell, { flex: 1.2, flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'center', borderRightWidth: 0 }]}>
                <TouchableOpacity onPress={() => handleEditTask(index)}>
                  <Ionicons name="create-outline" size={18} color="#0056FF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteTask(index)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        <TouchableOpacity 
          style={[styles.saveButton, (isSaving || dailyTasks.length === 0) && { opacity: 0.7 }]} 
          onPress={handleSaveAll}
          disabled={isSaving || dailyTasks.length === 0}
        >
          {isSaving ? (
            <ActivityIndicator color={Brand.colors.white} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>save</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F6F9' }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={[
            styles.contentContainer, 
            { paddingBottom: 120 },
            isDesktop && { maxWidth: '100%' }
          ]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={isDesktop ? styles.desktopLayoutRow : styles.card}>
            {isDesktop ? (
              <>
                {/* Left Column: Form Card */}
                <View style={styles.desktopFormColumn}>
                  <View style={styles.header}>
                    <View style={styles.headerIndicator} />
                    <Text style={styles.headerTitle}>DAILY TASK TRACKER</Text>
                  </View>
                  <View style={styles.form}>
                    {renderFormFields()}
                  </View>
                </View>

                {/* Right Column: Table Card & Submit */}
                <View style={styles.desktopTableColumn}>
                  <View style={styles.header}>
                    <View style={styles.headerIndicator} />
                    <Text style={styles.headerTitle}>TODAY'S LOGGED TASKS</Text>
                  </View>
                  <View style={styles.form}>
                    {renderTableAndSubmit()}
                  </View>
                </View>
              </>
            ) : (
              // Mobile / Tablet: Single Card Vertical Stack (Current layout)
              <>
                <View style={styles.header}>
                  <View style={styles.headerIndicator} />
                  <Text style={styles.headerTitle}>DAILY TASK TRACKER</Text>
                </View>
                <View style={styles.form}>
                  {renderFormFields()}
                  {renderTableAndSubmit()}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Brand.colors.card,
    borderRadius: 12,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    maxWidth: 900,
  },
  desktopLayoutRow: {
    flexDirection: 'row',
    gap: 24,
    width: '100%',
    alignItems: 'flex-start',
  },
  desktopFormColumn: {
    flex: 45,
    backgroundColor: Brand.colors.card,
    borderRadius: 12,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  desktopTableColumn: {
    flex: 55,
    backgroundColor: Brand.colors.card,
    borderRadius: 12,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 24,
  },
  headerIndicator: {
    width: 4,
    height: 20,
    backgroundColor: Brand.colors.primary,
    marginRight: 12,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.primaryDark,
    letterSpacing: 0.5,
  },
  form: {
    gap: 24,
  },
  fieldRowHorizontal: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap',
  },
  fieldRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  flexHalf: {
    flex: 1,
    minWidth: 140, // Reduced from 200 to prevent mobile overflow
    gap: 8,
  },
  flexThird: {
    flex: 1,
    minWidth: 90, // Reduced from 120 to prevent mobile overflow
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  inputContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: Brand.colors.white,
    height: 50,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: Brand.colors.white,
    height: 50,
  },
  textArea: {
    minHeight: 120,
    height: 'auto',
    paddingTop: 12,
  },
  picker: {
    flex: 1,
    width: '100%',
    height: 50,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: '#1F2937',
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 8,
  },
  durationInput: {
    color: '#1F2937',
    fontWeight: '600',
  },
  addButtonWrapper: {
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  addButton: {
    backgroundColor: '#0056FF',
    borderWidth: 1,
    borderColor: '#0056FF',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  tableContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  tableHeaderCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  tableCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#1F2937',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  emptyTable: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTableText: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  saveContainer: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: '#0056FF',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  mobileTimesFieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    width: '100%',
  },
  mobileTimeField: {
    flex: 1,
    gap: 8,
  },
  mobileAddBtnContainer: {
    marginTop: 16,
    width: '100%',
  },
  mobileAddBtn: {
    backgroundColor: '#0056FF',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mobileAddBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  coilRefsSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    marginBottom: 8,
  },
  fieldRowVertical: {
    flexDirection: 'column',
    gap: 12,
  },
  flexFull: {
    width: '100%',
    gap: 8,
  },
});
