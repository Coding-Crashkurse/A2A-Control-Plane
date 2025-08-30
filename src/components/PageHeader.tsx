import { Box, Typography, Stack } from "@mui/material";
import { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      mb={2}
    >
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body2"
            component="div"
            color="text.secondary"
            sx={{ mt: 0.25 }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
    </Stack>
  );
}
