import { ReactNode } from "react";
import { AppBar, Toolbar, Typography, Box, Drawer, List, ListItemButton } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

const drawerWidth = 200;
const Nav = [
  { to: "/", label: "Dashboard" },
  { to: "/tasks", label: "Tasks" },
  { to: "/playground", label: "Playground" },
  { to: "/agents", label: "Agents" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6">A2A Control Plane</Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, borderRight: "1px solid", borderColor: "divider" },
        }}
      >
        <Toolbar />
        <List>
          {Nav.map((n) => (
            <ListItemButton key={n.to} component={Link} to={n.to} selected={pathname === n.to}>
              {n.label}
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, pl: 4, pr: 3, pt: 2, pb: 3 }}>
        <Toolbar sx={{ minHeight: 56 }} />
        {children}
      </Box>
    </Box>
  );
}
