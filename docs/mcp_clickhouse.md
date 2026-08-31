# Official ClickHouse MCP Server Configuration

This document describes the integration of the official **ClickHouse Model Context Protocol (MCP)** server into the Frame Sense Docker development environment.

---

## 1. Overview

The ClickHouse MCP server exposes ClickHouse database tools (schema introspection, table listing, query execution) via the Model Context Protocol (MCP) using Streamable HTTP / Server-Sent Events (SSE) transport. This establishes the foundation for later agentic orchestration via the Google Agent Platform.

---

## 2. Docker Architecture

* **Docker Service Name**: `mcp-clickhouse`
* **Container Name**: `frame-sense-mcp-clickhouse`
* **Official Image**: `ghcr.io/clickhouse/mcp-clickhouse:latest` (Version 0.4.1+)
* **Docker Network**: `framesense_default` (shared with `frame-sense-clickhouse`)
* **Local Endpoint**: `http://localhost:8000/sse`
* **Health Check Endpoint**: `http://localhost:8000/health`

---

## 3. Environment & Connection Settings

The service connects internally to the ClickHouse container using HTTP protocol:

| Variable | Configured Value | Description |
| :--- | :--- | :--- |
| `CLICKHOUSE_HOST` | `clickhouse` | Internal Docker Compose network hostname |
| `CLICKHOUSE_PORT` | `8123` | ClickHouse HTTP interface port |
| `CLICKHOUSE_USER` | `default` | ClickHouse database user |
| `CLICKHOUSE_PASSWORD` | `""` | Database password (empty for local dev) |
| `CLICKHOUSE_DATABASE` | `default` | Primary target database |
| `CLICKHOUSE_SECURE` | `false` | Disabled TLS for internal local docker bridge |
| `CLICKHOUSE_MCP_SERVER_TRANSPORT` | `sse` | Enables Streamable HTTP / SSE transport |
| `CLICKHOUSE_MCP_BIND_HOST` | `0.0.0.0` | Container network bind address |
| `CLICKHOUSE_MCP_BIND_PORT` | `8000` | Transport listening port |
| `CLICKHOUSE_MCP_AUTH_DISABLED` | `true` | Unauthenticated local development mode |

---

## 4. Exposed MCP Tools

The official ClickHouse MCP server exposes the following tools to MCP client agents:

1. **`list_databases`**: Lists all available databases in the target ClickHouse instance.
2. **`list_tables`**: Introspects table structures, column definitions, data types, engines, primary keys, and row statistics.
3. **`run_query`**: Executes SELECT queries against ClickHouse for real-time telemetry analysis.

---

## 5. Verification Commands

### Check Health Endpoint
```bash
curl http://localhost:8000/health
# Expected Output: OK
```

### Inspect Docker Container Status
```bash
docker ps --filter "name=frame-sense-mcp-clickhouse"
```

### Inspect Registered MCP Tools
```bash
docker exec frame-sense-mcp-clickhouse python -c "from mcp_clickhouse.mcp_server import list_tables; print(list_tables('default'))"
```
