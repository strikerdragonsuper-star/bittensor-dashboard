# Bittensor Subnet Dashboard

Unified dashboard for your Bittensor subnets:

| Netuid | Name | Focus |
|--------|------|-------|
| **15** | ORO | AI shopping agents |
| **23** | Trishool | AI guard / adversarial eval |
| **74** | Gittensor | OSS contribution rewards |
| **83** | CliqueAI | Max-clique solver network |

## Features

### Phase 1 — On-chain (Taostats)
- Subnet overview: neuron counts, stake, emissions
- Metagraph table: miners & validators
- Wallet lookup: balance + positions across all four subnets

### Phase 2 — Subnet-specific
| Subnet | Panel | Data source | Auth |
|--------|-------|-------------|------|
| **SN15** | ORO race leaderboard | `api.oroagents.com` public API | None |
| **SN23** | Trishool platform info | Link + on-chain metagraph | Validator wallet (future) |
| **SN74** | Gittensor miner score | Local `gitt miner score --json` | GitHub PAT |
| **SN83** | CliqueAI runs | W&B `toptensor-ai/CliqueAI` | W&B API key |

## Quick start

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env — at minimum set TAOSTATS_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Configuration

`backend/.env`:

```env
# Required for on-chain metagraph
TAOSTATS_API_KEY=your_key_here

# Optional — Phase 2
GITTENSOR_REPO_PATH=C:\Users\a\Documents\work_space\bittensor\74\gittensor
GITTENSOR_MINER_PAT=ghp_...
WANDB_API_KEY=your_wandb_key
```

| Key | Where to get it |
|-----|-----------------|
| `TAOSTATS_API_KEY` | [taostats.io/pro](https://taostats.io/pro) |
| `GITTENSOR_MINER_PAT` | GitHub → Settings → Developer settings → PAT |
| `WANDB_API_KEY` | [wandb.ai/authorize](https://wandb.ai/authorize) |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subnets/{netuid}/overview` | Subnet summary |
| GET | `/api/subnets/{netuid}/neurons` | Metagraph |
| GET | `/api/subnets/15/oro/leaderboard` | ORO top agent + race qualifiers |
| GET | `/api/subnets/23/trishool/info` | Trishool platform status |
| POST | `/api/subnets/74/gittensor/score` | Run local Gittensor scoring |
| GET | `/api/subnets/83/clique/runs` | Latest CliqueAI W&B runs |
| GET | `/api/wallets/{address}/portfolio` | Wallet positions |
