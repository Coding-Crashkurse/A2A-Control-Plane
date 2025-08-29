import { useState } from "react";
import { Box, TextField, Button, Alert, Stack, Chip, Card, CardContent, Typography, IconButton } from "@mui/material";
import { useAgents } from "../../context/AgentContext";
import { Delete, CheckCircle } from "@mui/icons-material";

export default function AgentsPage(){
  const { agents, activeId, addByCard, setActive, remove } = useAgents();
  const [url,setUrl]=useState("https://your-agent/.well-known/agent-card.json");
  const [auth,setAuth]=useState(""); // z.B. "Bearer <token>"
  const [err,setErr]=useState<string|null>(null);
  const [ok,setOk]=useState<string|null>(null);

  const add = async ()=>{
    setErr(null); setOk(null);
    try {
      await addByCard(url, auth || undefined);
      setOk("Agent hinzugefügt und aktiviert.");
    } catch(e:any){ setErr(e.message); }
  };

  return (
    <Box>
      <Stack direction={{ xs:"column", sm:"row" }} spacing={1} mb={2}>
        <TextField fullWidth label="Agent‑Card URL" value={url} onChange={e=>setUrl(e.target.value)} />
        <TextField fullWidth label="Authorization (optional)" value={auth} onChange={e=>setAuth(e.target.value)} placeholder="Bearer <token>" />
        <Button onClick={add}>Hinzufügen</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb:2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb:2 }}>{ok}</Alert>}

      <Stack spacing={1}>
        {agents.map(ag=>(
          <Card key={ag.id} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="h6">{ag.name}</Typography>
                  <Chip label="REST" color="success" size="small"/>
                  {ag.version && <Chip label={`v${ag.version}`} size="small"/>}
                  <Typography variant="body2" color="text.secondary">{ag.baseUrl}</Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={ag.id===activeId ? "contained" : "outlined"}
                    startIcon={<CheckCircle/>}
                    onClick={()=>setActive(ag.id)}
                  >
                    {ag.id===activeId ? "Aktiv" : "Aktivieren"}
                  </Button>
                  <IconButton aria-label="delete" onClick={()=>remove(ag.id)}><Delete/></IconButton>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
