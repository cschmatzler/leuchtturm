# Observability Fix Plan

## Goal

Every node runs Grafana Alloy as the single local telemetry agent. Each service
on a node is scraped by or pushes to its local Alloy. Local Alloys forward
everything to the chevrotain-observability node's Alloy, which fans out to
Prometheus, Loki, and Tempo.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ chevrotain-web   │     │ chevrotain-zero  │     │chevrotain-postgres│
│                  │     │                  │     │                   │
│ API ──OTLP──┐   │     │ zero ──OTLP──┐  │     │ pg-exp ◄─scrape─┐│
│ node-exp ◄──┤   │     │ node-exp ◄───┤  │     │ node-exp ◄──────┤│
│             ▼   │     │              ▼  │     │                 ▼ │
│         [ Alloy ] │     │         [ Alloy ] │     │          [ Alloy ]│
└────────┬────────┘     └────────┬────────┘     └─────────┬────────┘
         │                       │                         │
         │        OTLP/HTTP      │         OTLP/HTTP       │
         └───────────┬───────────┴─────────────────────────┘
                     ▼
         ┌───────────────────────────────────┐
         │     chevrotain-observability       │
         │                                   │
         │  node-exp ◄─scrape─┐              │
         │  grafana ◄─────────┤              │
         │  loki ◄────────────┤              │
         │  tempo ◄───────────┤              │
         │  prometheus ◄──────┤              │
         │                    ▼              │
         │              [ Alloy ]             │
         │                 │                 │
         │    ┌────────────┼────────────┐    │
         │    ▼            ▼            ▼    │
         │ Prometheus    Tempo        Loki   │
         └───────────────────────────────────┘
```

---

## 1. Make alloy-agent.nix forward to observability Alloy, not directly to backends

**File:** `platform/hosts/alloy-agent.nix`

Change the three export destinations from individual backend endpoints to a
single OTLP HTTP export targeting `chevrotain-observability:4318` (the
observability Alloy).

- Remove `prometheus.remote_write`, `otelcol.exporter.otlphttp "tempo"`,
  `otelcol.exporter.loki`, and `loki.write` exporters.
- Replace with a single `otelcol.exporter.otlphttp "gateway"` pointing at
  `http://${cfg.hosts.observability}:${cfg.ports.alloyOtlp}`.
- Wire the batch processor output to this single exporter for metrics, logs,
  and traces.
- Keep `loki.source.journal` and `loki.relabel.journal` but convert their
  output to the OTLP pipeline via `otelcol.receiver.loki` or
  `loki.write` pointing at the local OTLP receiver so journal logs also flow
  through the single gateway path. Alternatively, keep a direct `loki.write`
  to the observability Loki if converting journal logs to OTLP is too lossy —
  but document the exception.

## 2. Add local Prometheus scraping to alloy-agent.nix

**File:** `platform/hosts/alloy-agent.nix`

Add a `prometheus.scrape` component that scrapes `127.0.0.1:${cfg.ports.nodeExporter}`
(the local node exporter). Forward scraped metrics into the OTLP pipeline so
they get sent to the observability Alloy along with everything else.

This replaces the central Prometheus scrape for node exporters.

## 3. Add per-node service scrape targets

Each node needs its local Alloy to scrape node-specific services:

### chevrotain-web

**File:** `platform/hosts/chevrotain-web/caddy.nix` or new file

- Scrape API metrics at `127.0.0.1:${cfg.ports.api}/api/metrics` from local
  Alloy. Add a `prometheus.scrape` component for this either in alloy-agent.nix
  via a parameter/option, or by extending the Alloy config in the web node module.

### chevrotain-postgres

**File:** `modules/chevrotain-postgres.nix`

- Scrape postgres exporter at `127.0.0.1:${cfg.ports.postgresExporter}` from
  local Alloy. Same approach — extend the Alloy config with an additional
  `prometheus.scrape` target.

### chevrotain-zero

No additional scrape targets needed beyond node exporter. zero-cache only
exports via OTLP push.

## 4. Refactor observability Alloy to be the ingestion gateway

**File:** `platform/hosts/chevrotain-observability/alloy.nix`

This Alloy already receives OTLP and fans out to local Prometheus/Tempo/Loki.
Changes needed:

- Add `prometheus.scrape` for the local node exporter
  (`127.0.0.1:${cfg.ports.nodeExporter}`).
- Add `prometheus.scrape` for local Grafana, Loki, Tempo, and Prometheus
  self-metrics (the targets currently in `prometheus.nix` scrapeConfigs for
  local services).
- Forward all scraped metrics into `prometheus.remote_write` to local
  Prometheus.

## 5. Remove centralized scrape configs from Prometheus

**File:** `platform/hosts/chevrotain-observability/prometheus.nix`

Remove all `scrapeConfigs` entries. Prometheus should only receive data via
`remote_write` from Alloy (already enabled via `--web.enable-remote-write-receiver`).

Alternatively, keep the `scrapeConfigs` as a fallback and remove later once
the Alloy-based scraping is confirmed working. If keeping temporarily, add a
comment marking them for removal.

## 6. Make alloy-agent.nix accept per-node extra config

**File:** `platform/hosts/alloy-agent.nix`

To avoid duplicating the full Alloy config in each node module, convert
alloy-agent.nix into a NixOS module that accepts an option for additional
Alloy config text (extra scrape targets). Each node module can then append
its service-specific scrape components.

Sketch:

```nix
# alloy-agent.nix
{ config, lib, ... }: let
  cfg = import ../../nix/config.nix;
in {
  options.chevrotain.alloy.extraConfig = lib.mkOption {
    type = lib.types.lines;
    default = "";
  };

  config = {
    services.alloy.enable = true;
    environment.etc."alloy/config.alloy".text = ''
      // ... base OTLP receiver, batch, gateway exporter, node exporter scrape ...

      ${config.chevrotain.alloy.extraConfig}
    '';
  };
}
```

Then in chevrotain-postgres.nix:

```nix
chevrotain.alloy.extraConfig = ''
  prometheus.scrape "postgres" {
    targets    = [{"__address__" = "127.0.0.1:${toString cfg.ports.postgresExporter}"}]
    forward_to = [prometheus.remote_write.default.receiver]
  }
'';
```

## 7. Remove per-node firewall rules for exporter ports

**Files:** `modules/chevrotain-web.nix`, `modules/chevrotain-zero.nix`,
`modules/chevrotain-postgres.nix`

Once scraped locally, node exporters and the postgres exporter no longer need
their ports open on the Tailscale interface. Remove the
`networking.firewall.interfaces."tailscale0".allowedTCPPorts` entries for
exporter ports. This reduces attack surface.

Keep the `alloyOtlp` port open on chevrotain-observability for receiving
forwarded telemetry.

---

## Execution order

- [x] **Step 6** — Refactor alloy-agent.nix into a NixOS module with `extraConfig`
- [x] **Steps 1 + 2** — Update alloy-agent.nix base config (gateway export + node exporter scrape)
- [x] **Step 3** — Add per-node extra scrape targets in each node module
- [x] **Step 4** — Update observability Alloy to scrape local services
- [x] **Step 5** — Remove centralized scrape configs from Prometheus
- [x] **Step 7** — Remove exporter firewall rules
- [ ] **Verify** — Deploy to one node first, confirm metrics flow, then roll out to all

## Implementation notes

### Data flow paths

OTLP data from apps (API, zero-cache) takes the full gateway path:

```
App → local Alloy OTLP receiver → batch → OTLP HTTP → gateway Alloy → Prometheus/Tempo/Loki
```

Prometheus-scraped metrics (node exporter, postgres exporter, API /metrics)
use `prometheus.remote_write` which cannot be converted to OTLP in Alloy, so
they go direct to Prometheus:

```
local Alloy prometheus.scrape → prometheus.remote_write → Prometheus on observability
```

Journal logs use Loki's native protocol, same limitation:

```
local Alloy loki.source.journal → loki.write → Loki on observability
```

All three paths originate from local Alloy. Only OTLP transits the gateway
Alloy due to protocol constraints — Alloy has no native Prometheus-to-OTLP or
Loki-to-OTLP conversion.

### Files changed

| File                                                     | Change                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `platform/hosts/alloy-agent.nix`                         | Rewritten as NixOS module. OTLP → gateway, local node exporter scrape, journal → Loki, `extraConfig` option. Also enables node exporter service.                                                             |
| `platform/hosts/chevrotain-observability/alloy.nix`      | Rewritten as gateway. OTLP fan-out to backends, local scraping of node/prometheus/grafana/loki/tempo, journal logs. Enables node exporter service.                                                           |
| `platform/hosts/chevrotain-observability/prometheus.nix` | Explicit `scrapeConfigs` with self-scrape fallback. Prometheus receives all other data via `remote_write` from Alloy. Kept `--web.enable-remote-write-receiver`. Removed node exporter (moved to alloy.nix). |
| `platform/hosts/chevrotain-observability/tempo.nix`      | Removed Tailscale firewall rules — Tempo is only accessed locally by gateway Alloy and Grafana.                                                                                                              |
| `platform/hosts/chevrotain-observability/loki.nix`       | Removed gRPC port from Tailscale firewall — only HTTP needed for agent log pushes. gRPC is internal only (`frontend_worker` uses `127.0.0.1`).                                                               |
| `modules/chevrotain-web.nix`                             | Removed node exporter config + Tailscale firewall. Added `extraConfig` to scrape API at `/api/metrics`.                                                                                                      |
| `modules/chevrotain-zero.nix`                            | Removed node exporter config + Tailscale firewall. Kept `docker0` firewall for OTLP.                                                                                                                         |
| `modules/chevrotain-postgres.nix`                        | Removed node exporter config + Tailscale firewall for both exporters. Added `extraConfig` to scrape postgres exporter.                                                                                       |
