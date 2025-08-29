// src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AppBar, Toolbar, Typography, Container, Box, Paper, Stack,
  useTheme, useMediaQuery,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, CardActions, Chip, CircularProgress, Button, Alert,
} from "@mui/material";
import {
  Bloodtype, LocationCity, AddLink, Close, Logout,
  PeopleAlt, Favorite, Healing, Warning,
} from "@mui/icons-material";

import { useAuth } from "../hooks/useAuth.js";
import apiClient from "../api/apiClient.js";
import StatCard from "../components/dashboard/StatCard.jsx";
import BloodGroupChart from "../components/dashboard/BloodGroupChart.jsx";
import ConfirmationDialog from "../components/common/ConfirmationDialog.jsx";

// --- Utility: Normalize API response into a clean array ---
const normalizeList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && typeof d === "object") {
    for (const k of Object.keys(d)) {
      if (Array.isArray(d[k])) return d[k];
    }
  }
  return [];
};

// --- Mock fallback data if API fails ---
const MOCK_STATS = { total_donors: 0, active_donors: 0, pending_patients: 0, patients_at_risk: 0 };
const MOCK_PATIENTS = [];
const MOCK_EMERGENCIES = [];
const MOCK_BLOOD_GROUPS = [];

// --- Tab Panel wrapper for accessibility ---
const TabPanel = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const DashboardPage = () => {
  const { logout } = useAuth();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));

  // --- State ---
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [bloodGroupData, setBloodGroupData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState({ open: false, title: "", message: "", onConfirm: null });

  // --- Fetch Dashboard Data from API ---
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        apiClient.get("/api/admin/stats"),
        apiClient.get("/api/admin/patients"),
        apiClient.get("/api/admin/emergencies"),
        apiClient.get("/api/admin/stats/blood-groups"),
      ]);

      const [statsRes, patientsRes, emergenciesRes, bloodGroupRes] = results;

      if (statsRes.status === "fulfilled") setStats(statsRes.value?.data ?? null);
      if (patientsRes.status === "fulfilled") setPatients(normalizeList(patientsRes.value));
      if (emergenciesRes.status === "fulfilled") setEmergencies(normalizeList(emergenciesRes.value));
      if (bloodGroupRes.status === "fulfilled") setBloodGroupData(bloodGroupRes.value?.data ?? []);

      // If everything failed -> use mock data
      const allRejected = results.every((r) => r.status === "rejected");
      if (allRejected) {
        setError("Failed to fetch dashboard data — using fallback mock data.");
        setStats(MOCK_STATS);
        setPatients(MOCK_PATIENTS);
        setEmergencies(MOCK_EMERGENCIES);
        setBloodGroupData(MOCK_BLOOD_GROUPS);
      }
    } catch (err) {
      console.error("Unexpected error in fetchDashboardData:", err);
      setError("Unexpected error. Using fallback.");
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // --- Tabs switch handler ---
  const handleTabChange = useCallback((_, newValue) => setTabValue(newValue), []);

  // --- Utility for API actions with refresh ---
  const executeApiAction = useCallback(async (action, successCallback, errorCallback) => {
    setError("");
    try {
      await action();
      if (successCallback) successCallback();
      await fetchDashboardData();
    } catch (err) {
      console.error("API Action Failed:", err);
      if (errorCallback) errorCallback(err);
      setError(err.response?.data?.message || "An error occurred. Please try again.");
    }
  }, [fetchDashboardData]);

  // --- Action Handlers with Confirmation Dialog ---
  const handleCreateBridge = useCallback((patientId, patientName) => {
    setDialog({
      open: true,
      title: "Confirm Bridge Creation",
      message: `Create a new Blood Bridge for "${patientName}"? This will update the patient's status.`,
      onConfirm: () => executeApiAction(() => apiClient.post(`/api/admin/patients/${patientId}/create-bridge`)),
    });
  }, [executeApiAction]);

  const handleCloseEmergency = useCallback((requestId, patientName) => {
    setDialog({
      open: true,
      title: "Confirm Close Request",
      message: `Close emergency request for "${patientName}"? This action cannot be undone.`,
      onConfirm: () => executeApiAction(() => apiClient.post(`/api/admin/emergencies/${requestId}/close`)),
    });
  }, [executeApiAction]);

  // --- Choose current tab data ---
  const activeData = useMemo(() => (tabValue === 0 ? patients : emergencies), [tabValue, patients, emergencies]);
  const dataKeyMap = useMemo(() => (
    tabValue === 0
      ? { name: "name", detail: "city", icon: <LocationCity /> }
      : { name: "patient_name", detail: "status", icon: null }
  ), [tabValue]);

  // --- Cards (for mobile view) ---
  const RenderCardGrid = ({ items }) => (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
      {items.map((item) => (
        <Card key={item.id} variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <CardContent sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom noWrap title={item[dataKeyMap.name] ?? ""}>
              {item[dataKeyMap.name] ?? "—"}
            </Typography>
            <Stack direction="column" spacing={1}>
              <Chip icon={<Bloodtype />} label={`Blood Group: ${item.blood_group ?? "N/A"}`} size="small" />
              <Chip icon={dataKeyMap.icon} label={`${dataKeyMap.detail}: ${item[dataKeyMap.detail] ?? "N/A"}`} size="small" />
            </Stack>
          </CardContent>
          <CardActions sx={{ justifyContent: "flex-end" }}>
            {tabValue === 0 ? (
              <Button variant="contained" size="small" startIcon={<AddLink />} onClick={() => handleCreateBridge(item.id, item.name)}>Create Bridge</Button>
            ) : (
              <Button variant="contained" color="secondary" size="small" startIcon={<Close />} onClick={() => handleCloseEmergency(item.id, item.patient_name)}>Close Request</Button>
            )}
          </CardActions>
        </Card>
      ))}
    </Box>
  );

  // --- Table (for desktop view) ---
  const RenderTable = ({ items }) => (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>{tabValue === 0 ? "City" : "Status"}</TableCell>
            <TableCell>Blood Group</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item[dataKeyMap.name] ?? "—"}</TableCell>
              <TableCell>{item[dataKeyMap.detail] ?? "—"}</TableCell>
              <TableCell>{item.blood_group ?? "N/A"}</TableCell>
              <TableCell align="right">
                {tabValue === 0 ? (
                  <Button size="small" startIcon={<AddLink />} onClick={() => handleCreateBridge(item.id, item.name)}>Create Bridge</Button>
                ) : (
                  <Button size="small" color="secondary" startIcon={<Close />} onClick={() => handleCloseEmergency(item.id, item.patient_name)}>Close</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // --- Decide content rendering ---
  const renderContent = () => {
    if (loading && !stats) {
      return <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>;
    }
    if (!activeData || activeData.length === 0) {
      return <Typography sx={{ p: 3, textAlign: "center" }}>No data available for this view.</Typography>;
    }
    return isSmallScreen ? <RenderCardGrid items={activeData} /> : <RenderTable items={activeData} />;
  };

  return (
    <Box sx={{ flexGrow: 1, backgroundColor: theme.palette.background.default, minHeight: "100vh" }}>
      {/* --- Header --- */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🩸 BloodBridge AI</Typography>
          <Button color="inherit" onClick={logout} startIcon={<Logout />}>Logout</Button>
        </Toolbar>
      </AppBar>

      {/* --- Body --- */}
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>Admin Dashboard</Typography>

        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {/* --- Stat Cards --- */}
        {stats && (
          <Box sx={{ display: "grid", gap: 3, mb: 4, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
            <StatCard title="Total Donors" value={stats.total_donors ?? 0} icon={<PeopleAlt />} color="primary.main" />
            <StatCard title="Active Donors" value={stats.active_donors ?? 0} icon={<Favorite />} color="success.main" />
            <StatCard title="Pending Patients" value={stats.pending_patients ?? 0} icon={<Healing />} color="info.main" />
            <StatCard title="Patients at Risk" value={stats.patients_at_risk ?? 0} icon={<Warning />} color="error.main" />
          </Box>
        )}

        {/* --- Main Grid (Patients/Emergencies + Blood Groups Chart) --- */}
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, alignItems: "start" }}>
          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Patients" />
                <Tab label="Emergencies" />
              </Tabs>
            </Box>
            <TabPanel value={tabValue} index={0}>{renderContent()}</TabPanel>
            <TabPanel value={tabValue} index={1}>{renderContent()}</TabPanel>
          </Paper>

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" gutterBottom>Donor Blood Groups</Typography>
            <Box sx={{ minHeight: 320 }}><BloodGroupChart data={bloodGroupData} /></Box>
          </Paper>
        </Box>
      </Container>

      {/* --- Confirmation Dialog --- */}
      <ConfirmationDialog
        open={dialog.open}
        onClose={() => setDialog({ ...dialog, open: false })}
        onConfirm={dialog.onConfirm}
        title={dialog.title}
        message={dialog.message}
      />
    </Box>
  );
};

export default DashboardPage;
