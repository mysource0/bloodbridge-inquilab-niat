// src/components/dashboard/BloodGroupChart.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';

/**
 * A responsive bar chart to display blood group distribution.
 * Expects data shape: [{ blood_group: 'A+', count: 10 }, ...]
 */
const BloodGroupChart = ({ data }) => {
  const theme = useTheme();

  // Defensive: normalize/sort data so chart is stable
  const prepared = useMemo(() => {
    if (!Array.isArray(data)) return [];
    // ensure numeric counts and stable ordering (by blood_group)
    return [...data]
      .map((d) => ({ blood_group: d.blood_group ?? 'Unknown', count: Number(d.count) || 0 }))
      .sort((a, b) => {
        // you can sort by count desc: return b.count - a.count;
        // here we sort by blood_group for predictable axis order
        return a.blood_group.localeCompare(b.blood_group);
      });
  }, [data]);

  if (!prepared || prepared.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Typography color="text.secondary">No chart data available.</Typography>
      </Box>
    );
  }

  return (
    // aria-label helps screen readers understand this visual
    <Box role="img" aria-label="Donor distribution by blood group">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={prepared}
          margin={{ top: 6, right: 16, left: -12, bottom: 6 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis dataKey="blood_group" stroke={theme.palette.text.secondary} />
          <YAxis stroke={theme.palette.text.secondary} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              borderColor: theme.palette.divider,
            }}
            formatter={(value) => [value, 'Donors']}
          />
          <Legend />
          <Bar dataKey="count" name="Total Donors" fill={theme.palette.primary.main} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

BloodGroupChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      blood_group: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ),
};

BloodGroupChart.defaultProps = {
  data: [],
};

export default React.memo(BloodGroupChart);
