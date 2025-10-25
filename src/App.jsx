import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // State for tasks, filter, sort, and active tab
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time'); // time, name
  const [activeTab, setActiveTab] = useState('personal'); // personal, pa
  const [newTask, setNewTask] = useState(() => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    return {
      name: '',
      description: '',
      time: currentTime,
      date: currentDate,
      type: 'personal',
      repeat: 'none',
      repeatDays: [],
      ringtone: 'default',
      customAudio: null
    };
  });
  const [editingTask, setEditingTask] = useState(null);
  const [alarmModal, setAlarmModal] = useState(null);
  const [notifiedTasks, setNotifiedTasks] = useState(new Set());
  const [currentAudio, setCurrentAudio] = useState(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Enhanced alarm system with recurring tasks
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (!task.completed && !notifiedTasks.has(task.id)) {
          const shouldTrigger = checkTaskTrigger(task, now);
          if (shouldTrigger) {
            // Play selected ringtone
            playRingtone(task.ringtone || 'default', task.customAudio);
            
            // Show visual alarm modal
            setAlarmModal(task);
            
            // Browser notification
            if (Notification.permission === 'granted') {
              new Notification(`🚨 Task Due: ${task.name}`, {
                body: task.description || 'No description',
                icon: '⏰',
                requireInteraction: true
              });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  new Notification(`🚨 Task Due: ${task.name}`, {
                    body: task.description || 'No description',
                    icon: '⏰',
                    requireInteraction: true
                  });
                }
              });
            }
            
            // Mark as notified
            setNotifiedTasks(prev => new Set([...prev, task.id]));
          }
        }
      });
    };

    const interval = setInterval(checkAlarms, 1000); // Check every second
    return () => clearInterval(interval);
  }, [tasks, notifiedTasks]);

  // Check if task should trigger based on repeat settings
  const checkTaskTrigger = (task, now) => {
    const taskTime = new Date(`${task.date}T${task.time}`);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const taskHour = taskTime.getHours();
    const taskMinute = taskTime.getMinutes();
    
    // Check if current time matches task time (hour and minute)
    const timeMatches = currentHour === taskHour && currentMinute === taskMinute;
    
    if (!timeMatches) return false;
    
    // For non-repeating tasks, check if it's the correct date
    if (!task.repeat || task.repeat === 'none') {
      const taskDate = task.date;
      const currentDate = now.toISOString().split('T')[0];
      return taskDate === currentDate;
    }
    
    // For repeating tasks
    if (task.repeat === 'daily') {
      return true;
    }
    
    if (task.repeat === 'weekly') {
      const taskDay = taskTime.getDay();
      const currentDay = now.getDay();
      return taskDay === currentDay;
    }
    
    if (task.repeat === 'custom' && task.repeatDays) {
      const currentDay = now.getDay();
      const adjustedDay = currentDay === 0 ? 6 : currentDay - 1;
      return task.repeatDays.includes(adjustedDay);
    }
    
    return false;
  };

  // Play ringtone based on selection
  const playRingtone = (ringtoneType, customAudioUrl = null) => {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    let audio;
    
    // For custom music
    if (ringtoneType === 'custom' && customAudioUrl) {
      audio = new Audio(customAudioUrl);
      audio.loop = false;
      audio.play().catch(() => {});
      
      // Auto-dismiss after 30 seconds
      setTimeout(() => {
        if (audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
        setAlarmModal(null);
      }, 30000);
    } else {
      // For built-in sounds, use Web Audio API to generate tones
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different sounds
      const frequencies = {
        default: 800,
        bell: 1000,
        chime: 600,
        beep: 1200,
        notification: 900
      };
      
      oscillator.frequency.setValueAtTime(frequencies[ringtoneType] || frequencies.default, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      // Create a repeating pattern
      const playPattern = () => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(frequencies[ringtoneType] || frequencies.default, audioContext.currentTime);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.5);
      };
      
      // Play pattern every second
      const interval = setInterval(playPattern, 1000);
      playPattern(); // Play immediately
      
      // Auto-stop after 30 seconds
      setTimeout(() => {
        clearInterval(interval);
        setAlarmModal(null);
      }, 30000);
      
      // Store interval to stop later
      audio = { 
        pause: () => clearInterval(interval),
        currentTime: 0
      };
    }
    
    setCurrentAudio(audio);
  };
  
  // Stop current audio
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  };

  // Add new task
  const addTask = () => {
    if (newTask.name && newTask.time && newTask.date) {
      const task = {
        id: Date.now(),
        ...newTask,
        completed: false,
        type: activeTab,
      };
      setTasks([...tasks, task]);
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);
      setNewTask({ 
        name: '', 
        description: '', 
        time: currentTime, 
        date: currentDate, 
        type: activeTab, 
        repeat: 'none', 
        repeatDays: [], 
        ringtone: 'default',
        customAudio: null
      });
    }
  };

  // Edit task
  const editTask = (id, updatedTask) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, ...updatedTask } : task));
    setEditingTask(null);
  };

  // Delete task
  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  // Toggle completion
  const toggleComplete = (id) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter(task => task.type === activeTab)
    .filter(task => {
      if (filter === 'completed') return task.completed;
      if (filter === 'pending') return !task.completed;
      return true;
    })
    .filter(task => {
      if (!searchTerm) return true;
      return task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    })
    .sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="app-container">
      <div className="main-card">
        <div className="header">
          <h1 className="title">✨ TaskFlow</h1>
          <p className="subtitle">Organize your life beautifully</p>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button
            className={`tab ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            <span className="tab-icon">👤</span>
            Personal
          </button>
          <button
            className={`tab ${activeTab === 'pa' ? 'active' : ''}`}
            onClick={() => setActiveTab('pa')}
          >
            <span className="tab-icon">💼</span>
            Work
          </button>
        </div>

        {/* Desktop Add Task Form */}
        <div className="add-task-card desktop-only">
          <h2 className="form-title">Create New Task</h2>
          <div className="form-grid">
            <div className="input-group">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                className="modern-input"
              />
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Add description..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="modern-input"
              />
            </div>
            <div className="input-group">
              <input
                type="time"
                value={newTask.time}
                onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                className="modern-input"
              />
            </div>
            <div className="input-group">
              <input
                type="date"
                value={newTask.date}
                onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                className="modern-input"
              />
            </div>
            <div className="input-group">
              <select
                value={newTask.repeat}
                onChange={(e) => setNewTask({ ...newTask, repeat: e.target.value, repeatDays: [] })}
                className="modern-input"
              >
                <option value="none">No Repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom Days</option>
              </select>
            </div>
            <div className="input-group">
              <select
                value={newTask.ringtone}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setNewTask({ ...newTask, ringtone: e.target.value, customAudio: null });
                  } else {
                    setNewTask({ ...newTask, ringtone: e.target.value });
                  }
                }}
                className="modern-input"
              >
                <option value="default">🔔 Default Alarm</option>
                <option value="bell">🛎️ Bell</option>
                <option value="chime">🎵 Chime</option>
                <option value="beep">📢 Beep</option>
                <option value="notification">📱 Notification</option>
                <option value="custom">🎶 Upload Custom Music</option>
              </select>
            </div>
            {newTask.ringtone === 'custom' && (
              <div className="input-group">
                <input
                  id="music-file"
                  type="file"
                  accept="audio/*"
                  key={newTask.customAudio ? 'has-file' : 'no-file'}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setNewTask({ ...newTask, customAudio: url });
                    }
                  }}
                  className="file-input"
                />
                <label htmlFor="music-file" className="file-label">
                  🎵 {newTask.customAudio ? 'Music Selected' : 'Choose Music File'}
                </label>
              </div>
            )}
            {newTask.repeat === 'custom' && (
              <div className="input-group repeat-days">
                <div className="days-selector">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      className={`day-btn ${newTask.repeatDays.includes(index) ? 'active' : ''}`}
                      onClick={() => {
                        const days = newTask.repeatDays.includes(index)
                          ? newTask.repeatDays.filter(d => d !== index)
                          : [...newTask.repeatDays, index];
                        setNewTask({ ...newTask, repeatDays: days });
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={addTask} className="add-btn">
            <span className="btn-icon">+</span>
            Add Task
          </button>
        </div>

        {/* Mobile Floating Action Button */}
        <button className="fab mobile-only" onClick={() => setShowNewTaskModal(true)}>
          +
        </button>

        {/* Search and Filters */}
        <div className="search-filters-container">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filters-row">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
              <option value="time">Sort by Time</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        {/* Task List */}
        <div className="tasks-container">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <p>No tasks yet. Create your first task!</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
                <div className="task-content">
                  <div className="task-header">
                    <h3 className="task-name">{task.name}</h3>
                    <div className="task-status">
                      {task.completed ? '✅' : '⏳'}
                    </div>
                  </div>
                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}
                  <div className="task-meta">
                    <span className="task-date">📅 {task.date}</span>
                    <span className="task-time">🕒 {task.time}</span>
                    {task.repeat && task.repeat !== 'none' && (
                      <span className="task-repeat">🔄 {task.repeat === 'daily' ? 'Daily' : task.repeat === 'weekly' ? 'Weekly' : 'Custom'}</span>
                    )}
                    {task.ringtone && task.ringtone !== 'default' && (
                      <span className="task-ringtone">🎵 {task.ringtone === 'custom' ? 'Custom Music' : task.ringtone}</span>
                    )}
                  </div>
                </div>
                <div className="task-actions">
                  <button 
                    onClick={() => toggleComplete(task.id)} 
                    className={`action-btn ${task.completed ? 'undo-btn' : 'complete-btn'}`}
                  >
                    {task.completed ? '↶' : '✓'}
                  </button>
                  <button onClick={() => setEditingTask(task)} className="action-btn edit-btn">
                    ✏️
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="action-btn delete-btn">
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alarm Modal */}
        {alarmModal && (
          <div className="alarm-overlay">
            <div className="alarm-modal">
              <div className="alarm-header">
                <div className="alarm-icon">🚨</div>
                <h2 className="alarm-title">TASK ALARM!</h2>
              </div>
              <div className="alarm-body">
                <h3 className="alarm-task-name">{alarmModal.name}</h3>
                {alarmModal.description && (
                  <p className="alarm-description">{alarmModal.description}</p>
                )}
                <div className="alarm-time">
                  📅 {alarmModal.date} at 🕒 {alarmModal.time}
                </div>
              </div>
              <div className="alarm-actions">
                <button 
                  onClick={() => {
                    stopAudio();
                    toggleComplete(alarmModal.id);
                    setAlarmModal(null);
                  }} 
                  className="alarm-complete-btn"
                >
                  ✅ Mark Complete
                </button>
                <button 
                  onClick={() => {
                    stopAudio();
                    setAlarmModal(null);
                  }} 
                  className="alarm-dismiss-btn"
                >
                  ⏰ Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Task Modal */}
        {showNewTaskModal && (
          <div className="modal-overlay">
            <div className="modal-content new-task-modal">
              <div className="modal-header">
                <h2 className="modal-title">Create New Task</h2>
                <button onClick={() => setShowNewTaskModal(false)} className="close-btn">×</button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="modal-input"
                />
                <input
                  type="text"
                  placeholder="Add description..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="modal-input"
                />
                <input
                  type="time"
                  value={newTask.time}
                  onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                  className="modal-input"
                />
                <input
                  type="date"
                  value={newTask.date}
                  onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                  className="modal-input"
                />
                <select
                  value={newTask.repeat}
                  onChange={(e) => setNewTask({ ...newTask, repeat: e.target.value, repeatDays: [] })}
                  className="modal-input"
                >
                  <option value="none">No Repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom Days</option>
                </select>
                <select
                  value={newTask.ringtone}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setNewTask({ ...newTask, ringtone: e.target.value, customAudio: null });
                    } else {
                      setNewTask({ ...newTask, ringtone: e.target.value });
                    }
                  }}
                  className="modal-input"
                >
                  <option value="default">🔔 Default Alarm</option>
                  <option value="bell">🛎️ Bell</option>
                  <option value="chime">🎵 Chime</option>
                  <option value="beep">📢 Beep</option>
                  <option value="notification">📱 Notification</option>
                  <option value="custom">🎶 Upload Custom Music</option>
                </select>
                {newTask.ringtone === 'custom' && (
                  <div>
                    <input
                      id="music-file-modal"
                      type="file"
                      accept="audio/*"
                      key={newTask.customAudio ? 'has-file-modal' : 'no-file-modal'}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setNewTask({ ...newTask, customAudio: url });
                        }
                      }}
                      className="file-input"
                    />
                    <label htmlFor="music-file-modal" className="file-label">
                      🎵 {newTask.customAudio ? 'Music Selected' : 'Choose Music File'}
                    </label>
                  </div>
                )}
                {newTask.repeat === 'custom' && (
                  <div className="days-selector">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        className={`day-btn ${newTask.repeatDays.includes(index) ? 'active' : ''}`}
                        onClick={() => {
                          const days = newTask.repeatDays.includes(index)
                            ? newTask.repeatDays.filter(d => d !== index)
                            : [...newTask.repeatDays, index];
                          setNewTask({ ...newTask, repeatDays: days });
                        }}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => {
                    addTask();
                    setShowNewTaskModal(false);
                  }} 
                  className="save-btn"
                >
                  ➕ Create Task
                </button>
                <button onClick={() => setShowNewTaskModal(false)} className="cancel-btn">
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingTask && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">Edit Task</h2>
                <button onClick={() => setEditingTask(null)} className="close-btn">×</button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  className="modal-input"
                  placeholder="Task name"
                />
                <input
                  type="text"
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="modal-input"
                  placeholder="Description"
                />
                <input
                  type="time"
                  value={editingTask.time}
                  onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })}
                  className="modal-input"
                />
                <input
                  type="date"
                  value={editingTask.date}
                  onChange={(e) => setEditingTask({ ...editingTask, date: e.target.value })}
                  className="modal-input"
                />
              </div>
              <div className="modal-actions">
                <button onClick={() => editTask(editingTask.id, editingTask)} className="save-btn">
                  💾 Save Changes
                </button>
                <button onClick={() => setEditingTask(null)} className="cancel-btn">
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;