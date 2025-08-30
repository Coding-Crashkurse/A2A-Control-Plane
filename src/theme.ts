// src/theme.ts
import { createTheme } from "@mui/material/styles";
// DataGrid Theme-Typen augmentieren
import "@mui/x-data-grid/themeAugmentation";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1F64FF",
      light: "#5A8AFF",
      dark: "#0C3AA9",
      contrastText: "#fff",
    },
    secondary: {
      main: "#00C2FF",
      light: "#5AD7FF",
      dark: "#0082B3",
    },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          background: "linear-gradient(90deg,#1F64FF,#0C3AA9)",
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: {
      defaultProps: { variant: "contained" },
      styleOverrides: { root: { textTransform: "none", borderRadius: 10 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiDataGrid: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiToolbar: {
  styleOverrides: { root: { minHeight: 56, "@media (min-width:600px)": { minHeight: 56 } } },
},
  },
});
