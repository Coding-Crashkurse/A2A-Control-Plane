// src/features/agents/AgentsPage.tsx
import { useMemo, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Alert,
  Stack,
  Chip,
  Typography,
  IconButton,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Link as MLink,
} from "@mui/material";
import {
  Delete,
  CheckCircle,
  ExpandMore,
  OpenInNew,
  Http as HttpIcon,
  CloudQueue,
  HistoryToggleOff,
  Extension,
  InfoOutlined,
} from "@mui/icons-material";
import { useAgents } from "../../context/AgentContext";
import type { AgentCard, AgentSkill } from "../../services/a2a/types";
import {
  isRestCapable,
  summarizeCard,
  fetchAgentCard,
  deriveCardUrlFromBase,
} from "../../services/a2a/agent";

type UiAgent = {
  id: string;
  name: string;
  version?: string;
  baseUrl?: string;
  cardUrl?: string;
  auth?: string;
  card?: AgentCard;
};

function ModeChips({ title, modes }: { title: string; modes: string[] }) {
  if (!modes?.length) return null;
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {modes.map((m) => (
          <Chip key={m} size="small" variant="outlined" label={m} />
        ))}
      </Stack>
    </Stack>
  );
}

function CapabilityChips({
  caps,
}: {
  caps: NonNullable<AgentCard["capabilities"]>;
}) {
  const items = [
    {
      k: "streaming",
      l: "streaming",
      on: !!caps.streaming,
      icon: <CloudQueue fontSize="small" />,
    },
    {
      k: "push",
      l: "push",
      on: !!caps.pushNotifications,
      icon: <CloudQueue fontSize="small" />,
    },
    {
      k: "state-history",
      l: "state-history",
      on: !!caps.stateTransitionHistory,
      icon: <HistoryToggleOff fontSize="small" />,
    },
  ];
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {items.map((i) =>
        i.on ? (
          <Chip
            key={i.k}
            size="small"
            color="success"
            icon={i.icon}
            label={i.l}
          />
        ) : null
      )}
      {(caps.extensions ?? []).map((e, idx) => (
        <Chip
          key={`${e.uri}-${idx}`}
          size="small"
          variant="outlined"
          color="info"
          icon={<Extension fontSize="small" />}
          label={e.description || `ext: ${e.uri}`}
        />
      ))}
    </Stack>
  );
}

function SkillBlock({ s }: { s: AgentSkill }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">{s.name}</Typography>
          <Chip size="small" variant="outlined" label={s.id} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {s.description}
        </Typography>
        {!!s.tags?.length && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {s.tags.map((t) => (
              <Chip key={t} size="small" variant="outlined" label={t} />
            ))}
          </Stack>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={0.5}>
          {!!s.inputModes?.length && (
            <ModeChips title="Input" modes={s.inputModes} />
          )}
          {!!s.outputModes?.length && (
            <ModeChips title="Output" modes={s.outputModes} />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function AgentsPage() {
  const { agents, activeId, addByCard, setActive, remove } = useAgents();
  const [url, setUrl] = useState(
    "https://your-agent/.well-known/agent-card.json"
  );
  const [auth, setAuth] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [cardCache, setCardCache] = useState<
    Record<string, AgentCard | undefined>
  >({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const add = async () => {
    setErr(null);
    setOk(null);
    try {
      await addByCard(url, auth || undefined);
      setOk("Agent added and activated.");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const uiAgents = useMemo(() => agents as UiAgent[], [agents]);

  async function ensureCard(ag: UiAgent) {
    const existing = ag.card || cardCache[ag.id];
    if (existing) return;
    const cardUrl =
      ag.cardUrl || (ag.baseUrl ? deriveCardUrlFromBase(ag.baseUrl) : undefined);
    if (!cardUrl) return;
    try {
      const card = await fetchAgentCard(cardUrl, ag.auth);
      setCardCache((s) => ({ ...s, [ag.id]: card }));
    } catch {
      // note in UI
    }
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={1} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Agent Card URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="Authorization (optional)"
              placeholder="Bearer <token>"
              value={auth}
              onChange={(e) => setAuth(e.target.value)}
            />
          </Grid>
          <Grid
            size={{ xs: 12, md: 2 }}
            sx={{
              display: "flex",
              justifyContent: { xs: "stretch", md: "flex-end" },
            }}
          >
            <Button onClick={add} sx={{ minWidth: 160, height: 40 }} fullWidth>
              Add
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Stack spacing={1.25}>
        {uiAgents.map((ag) => {
          const card: AgentCard | undefined = ag.card || cardCache[ag.id];
          const summary = card ? summarizeCard(card) : null;
          const restOk = card ? isRestCapable(card) : true;
          const expanded = expandedId === ag.id;

          return (
            <Accordion
              key={ag.id}
              disableGutters
              square={false}
              expanded={expanded}
              onChange={(_, exp) => {
                setExpandedId(exp ? ag.id : null);
                if (exp) ensureCard(ag);
              }}
              sx={{
                mb: 0.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                boxShadow: 1,
                backgroundColor: "background.paper",
                transition: "box-shadow .2s, border-color .2s, transform .15s",
                "&:hover": {
                  boxShadow: 4,
                  borderColor: "primary.light",
                  transform: "translateY(-1px)",
                },
                "& .MuiAccordionSummary-root": {
                  px: 2,
                  py: 1.25,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                },
                "& .MuiAccordionDetails-root": { px: 2, pb: 2, pt: 1 },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ width: "100%" }}
                  flexWrap="wrap"
                >
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Typography variant="h6">{ag.name}</Typography>
                    {restOk && (
                      <Chip
                        label="REST"
                        color="success"
                        size="small"
                        icon={<HttpIcon />}
                      />
                    )}
                    {ag.version && <Chip label={`v${ag.version}`} size="small" />}
                    {ag.baseUrl && (
                      <Typography variant="body2" color="text.secondary">
                        {ag.baseUrl}
                      </Typography>
                    )}
                  </Stack>
                  {ag.id === activeId && (
                    <Chip size="small" color="primary" label="active" />
                  )}
                </Stack>
              </AccordionSummary>

              <AccordionDetails>
                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  {ag.id !== activeId && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CheckCircle />}
                      onClick={() => setActive(ag.id)}
                    >
                      Set active
                    </Button>
                  )}
                  <IconButton aria-label="delete" onClick={() => remove(ag.id)}>
                    <Delete />
                  </IconButton>
                </Stack>

                {summary ? (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={1.2}>
                          <Typography variant="subtitle2">Transport</Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                          >
                            <Chip
                              size="small"
                              color="primary"
                              label={`preferred: ${summary.preferredTransport}`}
                            />
                            {summary.interfaces.map((i: any) => (
                              <Chip
                                key={`${i.transport}|${i.url}`}
                                size="small"
                                variant="outlined"
                                label={
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                  >
                                    <span>{i.transport}</span>
                                    <MLink
                                      href={i.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      underline="none"
                                    >
                                      <OpenInNew fontSize="inherit" />
                                    </MLink>
                                  </Stack>
                                }
                              />
                            ))}
                          </Stack>

                          <Divider />

                          <Typography variant="subtitle2">
                            Capabilities
                          </Typography>
                          <CapabilityChips caps={summary.capabilities} />

                          <Divider />

                          <Typography variant="subtitle2">Defaults</Typography>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                          >
                            <ModeChips
                              title="Input"
                              modes={summary.defaultInputModes}
                            />
                            <ModeChips
                              title="Output"
                              modes={summary.defaultOutputModes}
                            />
                          </Stack>
                        </Stack>
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={1.2}>
                          <Typography variant="subtitle2">Security</Typography>
                          {summary.securitySchemes &&
                          Object.keys(summary.securitySchemes).length > 0 ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {Object.entries(summary.securitySchemes).map(
                                ([name, scheme]) => (
                                  <Chip
                                    key={name}
                                    size="small"
                                    variant="outlined"
                                    label={`${name} • ${(scheme as any).type}`}
                                  />
                                )
                              )}
                            </Stack>
                          ) : (
                            <Chip
                              size="small"
                              icon={<InfoOutlined />}
                              label="no security schemes declared"
                            />
                          )}

                          {summary.provider && (
                            <>
                              <Divider />
                              <Typography variant="subtitle2">
                                Provider
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                flexWrap="wrap"
                              >
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={summary.provider.organization}
                                />
                                {summary.provider.url && (
                                  <MLink
                                    href={summary.provider.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {summary.provider.url}
                                  </MLink>
                                )}
                              </Stack>
                            </>
                          )}

                          {summary.documentationUrl && (
                            <>
                              <Divider />
                              <Typography variant="subtitle2">
                                Documentation
                              </Typography>
                              <MLink
                                href={summary.documentationUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {summary.documentationUrl}
                              </MLink>
                            </>
                          )}
                        </Stack>
                      </Grid>

                      <Grid size={{ xs: 12 }}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Skills ({summary.skills.length})
                        </Typography>
                        <Grid container spacing={1}>
                          {summary.skills.map((s) => (
                            <Grid key={s.id} size={{ xs: 12, md: 6, lg: 4 }}>
                              <SkillBlock s={s} />
                            </Grid>
                          ))}
                          {summary.skills.length === 0 && (
                            <Grid size={{ xs: 12 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                No skills declared.
                              </Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Grid>
                    </Grid>
                  </Paper>
                ) : (
                  <Alert severity="info" sx={{ m: 1 }}>
                    No agent card cached. On expand the app will try to load it
                    automatically from the base URL.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Box>
  );
}
