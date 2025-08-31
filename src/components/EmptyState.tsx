import { Paper, Stack, Typography, Box, Chip, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import type { ReactNode } from "react";
import { AddCircleOutline, Link as LinkIcon, LockOpen, CheckCircleOutline } from "@mui/icons-material";

export default function EmptyState({
  title, subtitle, actions, children,
  icon = <AddCircleOutline fontSize="large" />,
}: { title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode; icon?: ReactNode; }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 4, borderRadius: 3, maxWidth: 900, mx: "auto", mt: 2,
        background: "linear-gradient(180deg, rgba(31,100,255,0.07) 0%, rgba(12,58,169,0.03) 60%, rgba(12,58,169,0.00) 100%)",
        boxShadow: 1,
        transition: "box-shadow .2s ease, transform .2s ease",
        "&:hover": { boxShadow: 4 },
      }}
    >
      <Stack spacing={3} alignItems="center" textAlign="center">
        <Box
          sx={{
            width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center",
            bgcolor: "primary.main", color: "primary.contrastText", boxShadow: 2,
            transition: "transform .2s ease", "&:hover": { transform: "scale(1.05)" },
          }}
        >
          {icon}
        </Box>
        <Stack spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Stack>
        {children}
        <Stack direction="row" spacing={1}>{actions}</Stack>
        <Chip size="small" variant="outlined" label="REST-only · A2A HTTP+JSON" icon={<CheckCircleOutline />} />
      </Stack>
    </Paper>
  );
}

export function Steps() {
  return (
    <List sx={{ width: "100%", maxWidth: 520, mx: "auto" }}>
      <ListItem>
        <ListItemIcon><LinkIcon color="primary" /></ListItemIcon>
        <ListItemText primary="Enter Agent Card URL" secondary="e.g. https://<host>/.well-known/agent-card.json" />
      </ListItem>
      <ListItem>
        <ListItemIcon><LockOpen color="action" /></ListItemIcon>
        <ListItemText primary="Optional: set Authorization" secondary='e.g. "Bearer <token>"' />
      </ListItem>
      <ListItem>
        <ListItemIcon><AddCircleOutline color="success" /></ListItemIcon>
        <ListItemText primary="Add and activate agent" />
      </ListItem>
    </List>
  );
}
