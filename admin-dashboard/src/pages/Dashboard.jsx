// admin-dashboard/src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AppBar, Toolbar, Typography, Container, Box, Paper, Stack,
  useTheme, useMediaQuery,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, CardActions, Chip, CircularProgress, Button, Alert,
  Badge, Grid, Snackbar
} from "@mui/material";
import {
  Bloodtype, LocationCity, AddLink, Close, Logout,
  PeopleAlt, Favorite, Healing, Warning,
  Dashboard as DashboardIcon, Inbox as InboxIcon,
  People as PeopleIcon, Emergency as EmergencyIcon,
  Hub as HubIcon, ShowChart as ShowChartIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  NotificationImportant as EscalationIcon,
  AddCircleOutline as AddCircleOutlineIcon
} from "@mui/icons-material";
import { createClient } from '@supabase/supabase-js';

import { useAuth } from "../hooks/useAuth.js";
import apiClient from "../api/apiClient.js";
import StatCard from "../components/dashboard/StatCard.jsx";
import BloodGroupChart from "../components/dashboard/BloodGroupChart.jsx";
import ConfirmationDialog from "../components/common/ConfirmationDialog.jsx";

// --- INITIALIZE SUPABASE CLIENT ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const normalizeList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  return [];
};

const TabPanel = ({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} {...other}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const getDueDateInfo = (dueDate) => {
  if (!dueDate) return { text: 'N/A', color: 'text.secondary', days: Infinity };
  const today = new Date();
  const nextDate = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);
  const diffTime = nextDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `OVERDUE by ${Math.abs(diffDays)} days`, color: 'error.main', days: diffDays };
  if (diffDays === 0) return { text: 'DUE TODAY', color: 'error.main', days: diffDays };
  if (diffDays <= 7) return { text: `Due in ${diffDays} days`, color: 'warning.main', days: diffDays };
  return { text: `Due in ${diffDays} days`, color: 'text.primary', days: diffDays };
};

const DashboardPage = () => {
  const { logout } = useAuth();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [dialogConfig, setDialogConfig] = useState({ open: false, title: '', message: '', onConfirm: () => {} });

  const [stats, setStats] = useState({});
  const [bloodGroupData, setBloodGroupData] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [pendingPatients, setPendingPatients] = useState([]);
  const [monitoredPatients, setMonitoredPatients] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        statsRes, 
        bloodGroupRes, 
        patientsRes, 
        emergenciesRes, 
        bridgesRes, 
        inboxRes,
        leaderboardRes
      ] = await Promise.all([
        apiClient.get('/api/admin/stats'),
        apiClient.get('/api/admin/stats/blood-groups'),
        apiClient.get('/api/admin/patients'),
        apiClient.get('/api/admin/emergencies'),
        apiClient.get('/api/admin/bridges'),
        apiClient.get('/api/admin/inbox'),
        apiClient.get('/api/admin/leaderboard')
      ]);

      setStats(statsRes.data || {});
      setBloodGroupData(bloodGroupRes.data || []);
      setEmergencies(normalizeList(emergenciesRes));
      setBridges(normalizeList(bridgesRes));
      setInboxMessages(normalizeList(inboxRes));
      setLeaderboard(normalizeList(leaderboardRes));

      const allPatients = normalizeList(patientsRes);
      const PENDING_STATUSES = ['pending', 'pending_opt_in', 'pending_details', 'pending_verification'];
      setPendingPatients(allPatients.filter(p => PENDING_STATUSES.includes(p.status)));
      
      const bridged = allPatients.filter(p => p.status === 'bridged');
      bridged.sort((a, b) => getDueDateInfo(a.next_due_date).days - getDueDateInfo(b.next_due_date).days);
      setMonitoredPatients(bridged);
    } catch (err) {
      setError('Failed to fetch data. Your session may have expired.');
      if (err.response && err.response.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchData();
    if (supabaseUrl && supabaseAnonKey) {
      const channel = supabase.channel('public-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          console.log('Real-time change detected, refetching data...');
          fetchData();
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchData]);

  const handleApiAction = async (action, successMessage) => {
    try {
      const response = await action();
      setSnackbar({ open: true, message: response.data.message || successMessage });
      fetchData();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Action failed!' });
    }
    setDialogConfig({ ...dialogConfig, open: false });
  };

  const confirmAction = (title, message, action, successMessage) => {
    setDialogConfig({ open: true, title, message, onConfirm: () => handleApiAction(action, successMessage) });
  };

  const renderLeaderboard = () => {
    if (loading && leaderboard.length === 0) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>;
    }
    if (!leaderboard || leaderboard.length === 0) {
      return <Typography sx={{ p: 3, textAlign: 'center', height: '100%' }}>No donor data for leaderboard.</Typography>;
    }
    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Points</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaderboard.map((donor, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{donor.name}</TableCell>
                <TableCell align="right">{donor.gamification_points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderDuePatientsAlert = () => {
    const duePatients = monitoredPatients.filter(p => getDueDateInfo(p.next_due_date).days <= 7);
    
    if (duePatients.length === 0) return null;
    
    return (
      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, mb: 4, border: 2, borderColor: 'error.main' }}>
        <Typography variant="h6" color="error.main" gutterBottom>
          Action Required: Patients Due for Transfusion
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {duePatients.map((p) => {
                const dueInfo = getDueDateInfo(p.next_due_date);
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.next_due_date ? new Date(p.next_due_date).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell sx={{ color: dueInfo.color }}>{dueInfo.text}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 0: // Analytics
        return (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item sx={{ width: { xs: '100%', sm: '50%', md: '25%' } }}>
              <StatCard icon={<PeopleIcon />} title="Total Donors" value={stats.total_donors} />
            </Grid>
            <Grid item sx={{ width: { xs: '100%', sm: '50%', md: '25%' } }}>
              <StatCard icon={<Favorite />} title="Active & Eligible" value={stats.active_donors} color="success.main" />
            </Grid>
            <Grid item sx={{ width: { xs: '100%', sm: '50%', md: '25%' } }}>
              <StatCard icon={<Warning />} title="Patients Due Soon" value={stats.patients_at_risk} color="warning.main" />
            </Grid>
            <Grid item sx={{ width: { xs: '100%', sm: '50%', md: '25%' } }}>
              <StatCard icon={<Healing />} title="Pending Patients" value={stats.pending_patients} color="info.main" />
            </Grid>
            
            <Grid item sx={{ width: { xs: '100%', lg: '66%' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Donor Blood Groups</Typography>
                <Box sx={{ height: 320 }}>
                  <BloodGroupChart data={bloodGroupData} />
                </Box>
              </Paper>
            </Grid>
            <Grid item sx={{ width: { xs: '100%', lg: '34%' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Top Donors Leaderboard</Typography>
                {renderLeaderboard()}
              </Paper>
            </Grid>
          </Grid>
        );
      
      case 1: // Inbox
        return (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User Phone</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inboxMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>{msg.user_phone}</TableCell>
                    <TableCell>{msg.user_message}</TableCell>
                    <TableCell><Chip label={msg.reason} color="warning" size="small" /></TableCell>
                    <TableCell align="right">
                      <Button 
                        onClick={() => confirmAction(
                          'Confirm Resolution', 
                          `Mark message from ${msg.user_phone} as resolved?`, 
                          () => apiClient.post(`/api/admin/inbox/${msg.id}/resolve`), 
                          'Message Resolved!'
                        )} 
                        startIcon={<CheckCircleOutlineIcon />}
                      >
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      
      case 2: // Pending Patients
        return (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingPatients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Chip label={p.status} size="small" /></TableCell>
                    <TableCell>
                      <Button 
                        onClick={() => confirmAction(
                          'Confirm Bridge Creation', 
                          `Create a bridge for ${p.name}?`, 
                          () => apiClient.post(`/api/admin/patients/${p.id}/create-bridge`), 
                          'Bridge Created!'
                        )} 
                        startIcon={<AddCircleOutlineIcon />}
                      >
                        Create Bridge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      
      case 3: // Patient Monitor
        return (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Patient Name</TableCell>
                  <TableCell>Next Transfusion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monitoredPatients.map((p) => { 
                  const ddi = getDueDateInfo(p.next_due_date); 
                  return (
                    <TableRow key={p.id} sx={{ backgroundColor: ddi.days < 0 ? 'rgba(255, 0, 0, 0.1)' : 'transparent' }}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell sx={{ color: ddi.color }}>{ddi.text}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        );
      
      case 4: // Active Emergencies
        return (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Patient</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {emergencies.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.patient_name}</TableCell>
                    <TableCell>{req.status}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          size="small" 
                          onClick={() => confirmAction(
                            'Confirm Closure', 
                            `Close request for ${req.patient_name}?`, 
                            () => apiClient.post(`/api/admin/emergencies/${req.id}/close`), 
                            'Request Closed!'
                          )} 
                          startIcon={<Close />}
                        >
                          Close
                        </Button>
                        <Button 
                          size="small" 
                          color="warning" 
                          onClick={() => confirmAction(
                            'Confirm Escalation', 
                            `Escalate request for ${req.patient_name}?`, 
                            () => apiClient.post(`/api/admin/emergencies/${req.id}/escalate`), 
                            'Escalation Initiated!'
                          )} 
                          startIcon={<EscalationIcon />}
                        >
                          Escalate
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      
      case 5: // Bridge Monitor
        return (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bridge Name</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Members</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bridges.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.patient_name}</TableCell>
                    <TableCell>{b.member_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🩸 BloodBridge AI Dashboard</Typography>
          <Button color="inherit" onClick={logout} startIcon={<Logout />}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 4, flexGrow: 1, overflowY: 'auto' }}>
        {renderDuePatientsAlert()}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={currentTab} 
              onChange={(e, val) => setCurrentTab(val)} 
              variant="scrollable" 
              scrollButtons="auto"
            >
              <Tab icon={<ShowChartIcon />} label="Analytics" />
              <Tab icon={<InboxIcon />} label={
                <Badge badgeContent={inboxMessages.length} color="error">
                  Inbox
                </Badge>
              } />
              <Tab icon={<PeopleIcon />} label={
                <Badge badgeContent={pendingPatients.length} color="primary">
                  Pending Patients
                </Badge>
              } />
              <Tab icon={<PeopleIcon />} label="Patient Monitor" />
              <Tab icon={<EmergencyIcon />} label="Active Emergencies" />
              <Tab icon={<HubIcon />} label="Bridge Monitor" />
            </Tabs>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderTabContent()
          )}
        </Paper>
      </Container>

      <ConfirmationDialog 
        {...dialogConfig} 
        onClose={() => setDialogConfig({ ...dialogConfig, open: false })} 
      />
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })} 
        message={snackbar.message} 
      />
    </Box>
  );
};

export default DashboardPage;