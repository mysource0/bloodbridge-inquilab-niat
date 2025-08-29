// src/components/dashboard/StatCard.jsx
import React from "react";
import PropTypes from "prop-types";
import { Paper, Box, Typography, Avatar, useTheme } from "@mui/material";

/**
 * A reusable component to display a single dashboard statistic.
 *
 * Props:
 * - icon: React node shown inside the Avatar
 * - title: short label for the stat
 * - value: numeric or string value to display
 * - color: theme token or CSS color for Avatar background (e.g. "primary.main")
 */
const StatCard = ({ icon, title, value, color = "primary.main" }) => {
  const theme = useTheme();

  // Resolve theme token like "primary.main" to an actual color string
  const resolvedColor = (() => {
    if (!color) return undefined;
    // if color contains a dot, treat as theme token
    if (typeof color === "string" && color.includes(".")) {
      const [paletteKey, shade] = color.split(".");
      return theme.palette?.[paletteKey]?.[shade] ?? color;
    }
    return color;
  })();

  // Format numbers nicely (1000 -> 1,000)
  const formattedValue =
    typeof value === "number"
      ? new Intl.NumberFormat().format(value)
      : value ?? "—";

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        display: "flex",
        alignItems: "center",
        height: "100%",
      }}
      role="region"
      aria-label={`${title} stat`}
      title={`${title}: ${formattedValue}`}
    >
      <Avatar
        sx={{
          bgcolor: resolvedColor,
          width: 56,
          height: 56,
          mr: 2,
          color: (theme.palette.getContrastText
            ? theme.palette.getContrastText(resolvedColor)
            : "#fff"),
        }}
        aria-hidden="true"
      >
        {icon}
      </Avatar>

      <Box sx={{ minWidth: 0 }}>
        <Typography color="text.secondary" noWrap variant="caption">
          {title}
        </Typography>
        <Typography variant="h5" component="div" fontWeight="bold" noWrap>
          {formattedValue}
        </Typography>
      </Box>
    </Paper>
  );
};

StatCard.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
};

StatCard.defaultProps = {
  icon: null,
  value: "0",
  color: "primary.main",
};

export default React.memo(StatCard);
