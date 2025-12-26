# Commodity Trading Dashboard - Requirements Document

## 1. Executive Summary

### 1.1 Project Overview
A comprehensive commodity trading intelligence platform that tracks precious metals (gold, silver, platinum) and leveraged ETF products, providing actionable buy/sell signals based on fund flows, price movements, and futures market activity.

### 1.2 Primary Objectives
- Monitor real-time and historical price data for precious metals across multiple instruments (spot, futures, options, ETFs)
- Track fund flows for leveraged commodity ETFs with focus on silver products (AGQ, etc.)
- Generate trading signals based on statistical analysis of flow patterns and price correlations
- Provide visual dashboard for decision-making and alerting system for extreme market conditions

### 1.3 Target Users
- Commodity traders focusing on precious metals
- Quantitative analysts tracking ETF flows
- Portfolio managers with commodity exposure

---

## 2. System Architecture

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Dashboard                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Price Charts │  │ Flow Analysis│  │ Signals/     │      │
│  │              │  │              │  │ Alerts       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway / Backend                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Data Service │  │ Analytics    │  │ Alert Engine │      │
│  │              │  │ Engine       │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Collection Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Market Data  │  │ ETF Flow     │  │ Futures/     │      │
│  │ Collectors   │  │ Scrapers     │  │ Options API  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Storage Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Time-Series  │  │ Relational   │  │ Cache/       │      │
│  │ DB (Prices)  │  │ DB (Metadata)│  │ Redis        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Recommended Technology Stack

#### Frontend
- **Framework**: React with TypeScript
- **Charting**: TradingView Lightweight Charts or Recharts
- **State Management**: React Query + Zustand
- **UI Components**: shadcn/ui or Material-UI
- **Build Tool**: Vite

#### Backend
- **Runtime**: Node.js (TypeScript) or Python (FastAPI)
- **API**: RESTful + WebSocket for real-time updates
- **Task Scheduler**: node-cron or APScheduler (Python)
- **Data Processing**: Pandas (Python) or TypeScript data libraries

#### Database
- **Time-Series**: TimescaleDB (PostgreSQL extension) or InfluxDB
- **Relational**: PostgreSQL
- **Cache**: Redis
- **File Storage**: S3-compatible (MinIO or AWS S3) for CSV archives

#### Infrastructure
- **Container**: Docker + Docker Compose
- **Orchestration**: Kubernetes (production) or Docker Swarm (simple deployment)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

---

## 3. Functional Requirements

### 3.1 Commodity Data Collection

#### 3.1.1 Precious Metals Coverage
**Requirement**: System shall track the following precious metals:
- **Gold (XAU)**
- **Silver (XAG)**
- **Platinum (XPT)**

#### 3.1.2 Instrument Types Per Commodity
For each metal, collect:

**A. Spot Prices**
- Real-time spot price ($/oz)
- Bid/Ask spreads
- Intraday tick data (optional for Phase 1, required for Phase 2)
- Daily OHLCV (Open, High, Low, Close, Volume)

**B. Futures Contracts**
- Front-month contract data (primary focus)
- Next 3-6 contracts (for curve analysis)
- Contract specifications: symbol, expiry, multiplier
- OHLCV data
- Open interest
- Exchange: COMEX (CME Group)

**C. Options Data** (Phase 2)
- At-the-money (ATM) options for front-month futures
- Implied volatility
- Put/Call ratios
- Open interest by strike

**D. Physical ETFs & ETNs**
- GLD (Gold Trust)
- SLV (iShares Silver Trust)
- PPLT (Physical Platinum)
- Daily price, volume, AUM

### 3.2 Leveraged ETF Tracking

#### 3.2.1 Target Tickers
**Primary Focus**:
- **AGQ** (ProShares Ultra Silver - 2x leveraged long)

**Extended List** (monitor for delisting/low volume):
- **USLV** (VelocityShares 3x Long Silver ETN) - *likely delisted*
- **DSLV** (VelocityShares 3x Inverse Silver ETN) - *likely delisted*
- **ZSL** (ProShares UltraShort Silver - 2x inverse)
- **SLVP** (iShares MSCI Global Silver Miners ETF) - miners, not pure silver
- **SILJ** (ETFMG Junior Silver Miners ETF)

**Action Items**:
- Maintain a configurable list of active tickers
- Flag tickers with average daily volume < 100k shares
- Auto-detect delisted products

#### 3.2.2 ETF Data Points
For each ticker, collect:
- Daily OHLCV
- Fund flows (weekly aggregation)
- AUM (Assets Under Management)
- Expense ratio
- Holdings composition (if available)
- Creation/Redemption activity (if available)
- Premium/Discount to NAV

### 3.3 Fund Flow Data Acquisition

#### 3.3.1 Data Sources
**Primary Sources**:
1. **ETFdb.com** - Free tier provides basic flow data
2. **ETF.com** - Flow data via CSV export or API
3. **Fallback**: Bloomberg, FactSet (require subscriptions)

**Data Format**:
- Weekly fund flow reports (net inflows/outflows in $)
- Historical flow data (minimum 2 years for z-score analysis)

#### 3.3.2 Collection Workflow
**Frequency**: Weekly (every Monday morning, capturing prior week data)

**Process**:
1. Automated scraper/API call to ETFdb.com or ETF.com
2. Download CSV or parse HTML tables
3. Validate data completeness
4. Store in database with timestamp
5. Trigger analytics pipeline

**Manual Override**: UI to manually upload CSV if automation fails

### 3.4 Analytics & Signal Generation

#### 3.4.1 Flow Analysis Metrics

**A. Rolling Sums**
- 4-week rolling sum of fund flows
- 13-week rolling sum
- 26-week rolling sum
- 52-week rolling sum

**B. Z-Score Calculation**
For each ticker and rolling window:
```
z-score = (current_flow - mean_historical_flow) / std_dev_historical_flow
```
- Use rolling 52-week history as baseline
- Flag z-scores > 2.0 (extreme inflow) or < -2.0 (extreme outflow)

**C. Percentile Ranking**
- Rank current week's flow against historical distribution
- Alert on >95th percentile (extreme inflow) or <5th percentile (extreme outflow)

#### 3.4.2 Correlation Analysis

**A. Flow vs. Price**
- Pearson correlation between weekly ETF flows and:
  - AGQ price change (weekly)
  - Spot silver price change
  - Front-month COMEX futures price change
- Rolling 26-week correlation window

**B. Volume Analysis**
- Compare AGQ volume spikes with flow extremes
- Detect divergences (high volume without flow confirmation)

**C. Flow Attribution**
Classify price moves as:
- **Flow-driven**: High correlation (r > 0.6) between flows and price
- **Futures-driven**: Price moves driven by futures OI/volume, weak flow correlation
- **Mixed**: Moderate correlation (0.3 < r < 0.6)

#### 3.4.3 Trading Signals

**Signal Types**:

**1. Extreme Flow Signal**
- **Trigger**: Z-score > 2.5 (Strong Buy) or < -2.5 (Strong Sell)
- **Confirmation**: 2 consecutive weeks in same direction
- **Output**: BUY/SELL recommendation with confidence score

**2. Flow-Price Divergence**
- **Trigger**: Large flow (>90th percentile) but price unchanged or opposite direction
- **Signal**: Potential reversal or delayed reaction
- **Output**: WATCH alert

**3. Futures-Spot Basis Signal**
- **Trigger**: Abnormal spread between front-month futures and spot price
- **Signal**: Contango/backwardation extremes
- **Output**: Market structure alert

**4. Momentum Alignment**
- **Trigger**: AGQ flows, spot silver, and futures all trending same direction for 3+ weeks
- **Signal**: Strong trend confirmation
- **Output**: STRONG BUY/STRONG SELL

**Signal Dashboard Display**:
- Current signal status for each ticker
- Signal strength (1-5 stars or percentage confidence)
- Time since signal triggered
- Historical signal accuracy (backtested win rate)

### 3.5 Alerting System

#### 3.5.1 Alert Channels
- **In-app notifications**: Dashboard banner
- **Email**: Digest summary + immediate alerts for extreme signals
- **Webhook**: Integration with Slack, Discord, or Telegram
- **SMS** (optional): For critical alerts only

#### 3.5.2 Alert Triggers
- Weekly flow data import complete
- Z-score exceeds threshold (configurable, default ±2.0)
- New trading signal generated
- Data collection failure (missing flows, API errors)
- Ticker delisted or volume below threshold

#### 3.5.3 Alert Configuration
User-configurable settings:
- Alert thresholds (z-score, percentile)
- Notification channels per alert type
- Quiet hours (suppress non-critical alerts)
- Digest schedule (daily, weekly)

---

## 4. Data Management Requirements

### 4.1 Data Storage Schema

#### 4.1.1 Time-Series Data (TimescaleDB/InfluxDB)

**Table: commodity_prices**
```sql
CREATE TABLE commodity_prices (
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,  -- XAU, XAG, XPT
    instrument_type VARCHAR(20),  -- SPOT, FUTURES, ETF
    contract_month DATE,          -- for futures
    open DECIMAL(12,4),
    high DECIMAL(12,4),
    low DECIMAL(12,4),
    close DECIMAL(12,4),
    volume BIGINT,
    open_interest BIGINT,         -- for futures
    PRIMARY KEY (timestamp, symbol, instrument_type, contract_month)
);

SELECT create_hypertable('commodity_prices', 'timestamp');
CREATE INDEX ON commodity_prices (symbol, instrument_type, timestamp DESC);
```

**Table: etf_prices**
```sql
CREATE TABLE etf_prices (
    timestamp TIMESTAMPTZ NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    open DECIMAL(12,4),
    high DECIMAL(12,4),
    low DECIMAL(12,4),
    close DECIMAL(12,4),
    volume BIGINT,
    adj_close DECIMAL(12,4),
    PRIMARY KEY (timestamp, ticker)
);

SELECT create_hypertable('etf_prices', 'timestamp');
```

**Table: etf_flows**
```sql
CREATE TABLE etf_flows (
    week_ending DATE NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    net_flow DECIMAL(16,2),        -- in USD millions
    aum DECIMAL(16,2),
    shares_outstanding BIGINT,
    premium_discount DECIMAL(6,4), -- percentage
    source VARCHAR(50),            -- ETFdb, ETF.com, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (week_ending, ticker)
);

SELECT create_hypertable('etf_flows', 'week_ending');
```

#### 4.1.2 Relational Data (PostgreSQL)

**Table: tickers**
```sql
CREATE TABLE tickers (
    ticker VARCHAR(10) PRIMARY KEY,
    name VARCHAR(200),
    asset_class VARCHAR(50),      -- SILVER_LEVERAGED, GOLD_ETF, etc.
    leverage_factor DECIMAL(4,2), -- 2.0 for 2x, -2.0 for inverse 2x
    expense_ratio DECIMAL(5,4),
    inception_date DATE,
    is_active BOOLEAN DEFAULT true,
    last_volume_check DATE,
    avg_daily_volume BIGINT,
    delisted_date DATE,
    notes TEXT
);
```

**Table: signals**
```sql
CREATE TABLE signals (
    id SERIAL PRIMARY KEY,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    ticker VARCHAR(10) REFERENCES tickers(ticker),
    signal_type VARCHAR(50),      -- EXTREME_FLOW, DIVERGENCE, MOMENTUM, etc.
    direction VARCHAR(10),        -- BUY, SELL, WATCH
    strength DECIMAL(3,2),        -- 0.0 to 1.0
    trigger_values JSONB,         -- store z-scores, correlations, etc.
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, CLOSED
    expires_at TIMESTAMPTZ
);

CREATE INDEX ON signals (ticker, generated_at DESC);
CREATE INDEX ON signals (status, generated_at DESC);
```

**Table: alert_log**
```sql
CREATE TABLE alert_log (
    id SERIAL PRIMARY KEY,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    alert_type VARCHAR(50),
    ticker VARCHAR(10),
    channel VARCHAR(20),          -- EMAIL, SLACK, IN_APP, etc.
    recipient VARCHAR(200),
    message TEXT,
    status VARCHAR(20)            -- SENT, FAILED, PENDING
);
```

#### 4.1.3 Computed Views

**View: latest_signals**
```sql
CREATE VIEW latest_signals AS
SELECT DISTINCT ON (ticker)
    ticker, signal_type, direction, strength, generated_at
FROM signals
WHERE status = 'ACTIVE' AND expires_at > NOW()
ORDER BY ticker, generated_at DESC;
```

**View: flow_statistics**
```sql
CREATE VIEW flow_statistics AS
SELECT
    ticker,
    week_ending,
    net_flow,
    AVG(net_flow) OVER (PARTITION BY ticker ORDER BY week_ending ROWS BETWEEN 51 PRECEDING AND CURRENT ROW) as flow_52w_avg,
    STDDEV(net_flow) OVER (PARTITION BY ticker ORDER BY week_ending ROWS BETWEEN 51 PRECEDING AND CURRENT ROW) as flow_52w_stddev,
    SUM(net_flow) OVER (PARTITION BY ticker ORDER BY week_ending ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) as flow_4w_sum,
    SUM(net_flow) OVER (PARTITION BY ticker ORDER BY week_ending ROWS BETWEEN 12 PRECEDING AND CURRENT ROW) as flow_13w_sum
FROM etf_flows
ORDER BY ticker, week_ending DESC;
```

### 4.2 Data Retention Policy
- **Intraday data**: 90 days (if collected)
- **Daily OHLCV**: Indefinite (archive to cold storage after 5 years)
- **Weekly flows**: Indefinite
- **Signals**: 2 years active, then archive
- **Alert logs**: 1 year

### 4.3 Data Quality & Validation
- Validate price data: no negative values, close within 5% of prior day (flag outliers)
- Validate flow data: check for missing weeks, outliers >5 standard deviations
- Source data checksums: detect corrupted CSV imports
- Automated daily data quality report

---

## 5. User Interface Requirements

### 5.1 Dashboard Layout

#### 5.1.1 Main Dashboard View
**Components**:
1. **Header Bar**
   - Current date/time
   - Last data update timestamp
   - Active alerts badge
   - User settings icon

2. **Signals Summary Panel** (Top Section)
   - Card grid showing active signals per ticker
   - Signal strength visualization (gauges or progress bars)
   - Color coding: Green (Buy), Red (Sell), Yellow (Watch), Gray (Neutral)
   - Click to drill down into signal details

3. **Ticker Selector**
   - Dropdown or tabs to switch between AGQ, ZSL, etc.
   - Display ticker metadata (leverage, AUM, status)

4. **Main Chart Area** (Central Section)
   - Multi-series line chart with dual Y-axes:
     - **Primary Y-axis**: Price (spot silver, AGQ, futures)
     - **Secondary Y-axis**: Fund flows (bar chart overlay)
   - Time range selector: 1M, 3M, 6M, 1Y, 2Y, All
   - Toggle series visibility (checkboxes or legend clicks)
   - Annotations: Mark signal trigger dates

5. **Analytics Panel** (Right Sidebar or Bottom Section)
   - Current z-scores (4w, 13w, 26w flows)
   - Percentile rankings
   - Correlation coefficients (flow vs. price)
   - Volume analysis (current vs. 20-day avg)
   - Flow attribution classification

6. **Data Table** (Bottom Section, Collapsible)
   - Tabular view of weekly flows with calculated metrics
   - Sortable columns
   - Export to CSV button

#### 5.1.2 Additional Views

**Signals History Page**
- Table of all historical signals with outcomes
- Filter by ticker, date range, signal type
- Performance metrics: win rate, avg return, avg hold time

**Multi-Ticker Comparison View**
- Side-by-side charts for AGQ, GLD, SLV
- Correlation heatmap
- Relative strength indicators

**Settings/Configuration Page**
- Alert preferences
- Signal thresholds
- Ticker watchlist management
- Data source configuration
- API key management (if using paid APIs)

### 5.2 Interactivity Requirements
- Charts must be zoomable and pannable
- Hover tooltips showing exact values
- Clickable signal indicators to view trigger details
- Real-time updates (WebSocket) for price data during market hours
- Responsive design (desktop primary, tablet/mobile secondary)

### 5.3 Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatible
- High contrast mode for charts

---

## 6. Integration & API Requirements

### 6.1 External Data APIs

#### 6.1.1 Market Data Sources

**Option 1: Free/Freemium APIs**
- **Alpha Vantage** (Free tier: 5 calls/min, 500 calls/day)
  - Endpoints: TIME_SERIES_DAILY, DIGITAL_CURRENCY_DAILY (crypto as proxy for metals)
  - Limitations: No direct futures data, limited commodity coverage

- **Yahoo Finance (yfinance library)**
  - Tickers: GC=F (gold futures), SI=F (silver futures), PL=F (platinum futures)
  - ETF tickers: AGQ, GLD, SLV, PPLT
  - Free, no API key required
  - Risk: Unofficial API, may break

- **Twelve Data** (Free tier: 800 calls/day)
  - Commodities and ETFs
  - More reliable than Yahoo Finance

**Option 2: Paid APIs (Production)**
- **Polygon.io** (Starter: $199/mo)
  - Stocks, ETFs, futures, options
  - Real-time and historical data

- **IEX Cloud** (Launch: $9/mo, good for testing)
  - Limited commodity coverage

- **CME Group DataMine** (Futures data)
  - Official COMEX data
  - Requires exchange fees

**Recommendation for MVP**:
- Use **yfinance** for initial development
- Migrate to **Polygon.io** or **Twelve Data** for production

#### 6.1.2 ETF Flow Data Sources

**ETFdb.com**
- Method: Web scraping (BeautifulSoup + requests)
- URL pattern: `https://etfdb.com/etf/AGQ/#etf-ticker-flow-of-funds`
- Data: Weekly flows, AUM
- Update frequency: Weekly (Fridays)
- Legal: Check robots.txt and ToS

**ETF.com**
- Method: CSV download (manual) or API if available
- URL: `https://www.etf.com/[ticker]`
- Data: Similar to ETFdb

**Fallback: Manual CSV Upload**
- UI form to upload weekly flow CSVs
- Parser to validate and import data

#### 6.1.3 API Rate Limiting & Caching
- Implement exponential backoff for failed requests
- Cache responses in Redis (TTL: 1 hour for intraday, 24 hours for daily data)
- Queue system (Bull/BullMQ) for scheduled data collection jobs

### 6.2 Internal API Design

#### 6.2.1 RESTful Endpoints

**Base URL**: `/api/v1`

**Price Data**
```
GET /commodities/{symbol}/prices?start_date={date}&end_date={date}&interval={daily|weekly}
GET /etfs/{ticker}/prices?start_date={date}&end_date={date}
GET /futures/{symbol}/prices?contract={YYYY-MM}&start_date={date}
```

**Flow Data**
```
GET /etfs/{ticker}/flows?start_date={date}&end_date={date}
POST /etfs/{ticker}/flows  (manual upload)
```

**Analytics**
```
GET /analytics/flows/{ticker}/statistics?window={4w|13w|26w|52w}
GET /analytics/correlations/{ticker}?start_date={date}
GET /analytics/signals?ticker={ticker}&status={active|all}
```

**Signals**
```
GET /signals?ticker={ticker}&type={type}&status={active|expired}
GET /signals/{id}
POST /signals (manual signal creation)
PUT /signals/{id}/status  (mark as closed)
```

**Alerts**
```
GET /alerts/config
PUT /alerts/config
GET /alerts/history
POST /alerts/test  (send test alert)
```

**Admin**
```
GET /tickers
POST /tickers  (add new ticker)
PUT /tickers/{ticker}  (update metadata)
GET /jobs/status  (data collection job status)
POST /jobs/trigger/{job_name}  (manual job trigger)
```

#### 6.2.2 WebSocket Events

**Channel**: `/ws/updates`

**Event Types**:
```json
{
  "type": "price_update",
  "ticker": "AGQ",
  "price": 42.15,
  "change": -0.35,
  "timestamp": "2025-12-26T14:30:00Z"
}

{
  "type": "new_signal",
  "ticker": "AGQ",
  "signal": {
    "type": "EXTREME_FLOW",
    "direction": "BUY",
    "strength": 0.85
  }
}

{
  "type": "alert",
  "message": "AGQ weekly flow z-score: 2.8 (95th percentile)",
  "severity": "high"
}
```

---

## 7. Non-Functional Requirements

### 7.1 Performance
- Dashboard load time: <2 seconds
- Chart rendering: <500ms for 2 years of daily data
- API response time: <200ms (p95) for analytical queries
- Database query time: <100ms for price data, <500ms for complex analytics

### 7.2 Scalability
- Support up to 50 tickers (extensible beyond silver/gold/platinum)
- Handle 10+ years of historical data per ticker
- Concurrent users: 10-100 (initial scope)

### 7.3 Reliability
- System uptime: 99% (allow for maintenance windows)
- Data collection success rate: >95% (with retry logic)
- Alert delivery: 99.9% (critical alerts)
- Automated backup: Daily database snapshots

### 7.4 Security
- API authentication: JWT tokens
- HTTPS only (TLS 1.3)
- API key encryption at rest
- Rate limiting: 100 req/min per user
- CORS configuration for frontend
- Input validation and sanitization (prevent SQL injection)

### 7.5 Compliance
- GDPR compliance (if storing user data)
- Financial data disclaimer: "Not investment advice"
- Respect data source ToS (attribution, rate limits)

---

## 8. Development Phases

### Phase 1: MVP (Minimum Viable Product) - 6-8 weeks

**Goals**:
- Functional dashboard for AGQ + spot silver + COMEX futures
- Basic flow data collection (manual CSV upload)
- Core analytics: z-scores, rolling sums, correlation
- Simple signal generation (extreme flow alerts)

**Deliverables**:
1. Backend API with endpoints for prices, flows, analytics
2. Database schema and initial seed data
3. Data collectors for yfinance (daily job)
4. Frontend dashboard with charts and signal display
5. Email alerting for extreme z-scores
6. Docker Compose setup for local deployment

**Tech Decisions**:
- **Frontend**: React + TypeScript + Vite + Recharts
- **Backend**: Node.js + TypeScript + Express (or Python + FastAPI)
- **Database**: PostgreSQL + TimescaleDB extension
- **Deployment**: Docker Compose (local) or single VPS (DigitalOcean, Linode)

**Out of Scope for MVP**:
- Options data
- Automated web scraping (manual CSV only)
- WebSocket real-time updates
- Multi-ticker comparison view
- SMS alerts
- Mobile optimization

### Phase 2: Enhanced Analytics - 4-6 weeks

**Goals**:
- Automated ETF flow scraping (ETFdb.com)
- Multi-ticker support (add GLD, SLV, PPLT, ZSL)
- Advanced signals (divergence, momentum alignment)
- Signal backtesting and performance tracking
- WebSocket for real-time price updates

**Deliverables**:
1. Web scraper service (Python + BeautifulSoup or Playwright)
2. Scheduler for weekly flow collection
3. Expanded signal engine with 4 signal types
4. Signals history page with performance metrics
5. Real-time price updates via WebSocket

### Phase 3: Production Hardening - 3-4 weeks

**Goals**:
- Migrate to production-grade APIs (Polygon.io or Twelve Data)
- Add options data (implied vol, put/call ratios)
- Kubernetes deployment
- Monitoring and alerting infrastructure
- User authentication and multi-user support

**Deliverables**:
1. Paid API integration (Polygon.io)
2. Options data tables and charts
3. Kubernetes manifests and Helm charts
4. Prometheus metrics + Grafana dashboards
5. User login and role-based access control (RBAC)

### Phase 4: Advanced Features - Ongoing

**Potential Enhancements**:
- Machine learning signal generation (LSTM, XGBoost)
- Sentiment analysis from news/Twitter
- Automated trading integration (via Alpaca, Interactive Brokers API)
- Mobile app (React Native)
- PDF report generation for weekly summaries
- Multi-language support

---

## 9. Success Metrics

### 9.1 Technical Metrics
- **Data Collection Uptime**: >95% successful weekly flow imports
- **API Availability**: >99% uptime
- **Query Performance**: p95 response time <200ms

### 9.2 User Metrics
- **Dashboard Engagement**: Daily active users, session duration
- **Signal Accuracy**: Backtested win rate >55% (for actionable signals)
- **Alert Relevance**: Low false positive rate (<10% of alerts ignored)

### 9.3 Business Metrics (if applicable)
- **Trading Performance**: Simulated portfolio returns vs. buy-and-hold
- **User Retention**: Month-over-month active user growth
- **Cost Efficiency**: Data API costs <$X per month

---

## 10. Risk Assessment & Mitigation

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data source API shutdown (yfinance) | High | Medium | Maintain fallback APIs, consider paid options |
| ETFdb.com blocks scraper | High | Medium | Implement polite scraping, manual CSV fallback |
| Database performance degradation | Medium | Low | Regular indexing, query optimization, TimescaleDB compression |
| Third-party API rate limits | Medium | Medium | Implement caching, request queuing, monitor usage |

### 10.2 Data Quality Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing weekly flow data | High | Automated alerts on missing data, manual upload UI |
| Incorrect/delayed price data | High | Validate against multiple sources, flag outliers |
| Signal false positives | Medium | Backtesting, confidence scoring, user feedback loop |

### 10.3 Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed weekly data collection window | Medium | Retry logic, manual trigger, email notifications |
| Server downtime during market hours | Low | Deploy on reliable hosting, monitoring, auto-restart |
| Cost overruns from API usage | Medium | Set budget alerts, monitor API call counts |

---

## 11. Open Questions & Decisions Needed

### 11.1 Architecture Decisions
- [ ] **Backend Language**: Node.js/TypeScript vs. Python/FastAPI?
  - **Recommendation**: Python for easier data science libraries (pandas, numpy)

- [ ] **Chart Library**: TradingView Lightweight Charts (professional) vs. Recharts (easier)?
  - **Recommendation**: Recharts for MVP, migrate to TradingView if needed

- [ ] **Deployment**: Docker Compose on single server vs. Kubernetes?
  - **Recommendation**: Docker Compose for MVP, K8s for Phase 3

### 11.2 Data Decisions
- [ ] **Options Data Priority**: Include in Phase 1 or defer to Phase 2?
  - **Recommendation**: Defer to Phase 2 (complexity vs. value for MVP)

- [ ] **Intraday Data**: Collect tick/minute data or daily only?
  - **Recommendation**: Daily for MVP, add intraday in Phase 2 if needed

- [ ] **Historical Data Depth**: How many years to backload?
  - **Recommendation**: Minimum 2 years for z-score calculation, ideally 5 years

### 11.3 Feature Prioritization
- [ ] **Backtesting**: Build custom backtester or integrate existing library (e.g., Backtrader)?
- [ ] **Alert Channels**: Email only for MVP, or include Slack/Telegram?
  - **Recommendation**: Email + webhook (Slack) for MVP

- [ ] **User Management**: Single user (private tool) or multi-user from start?
  - **Recommendation**: Single user for MVP, add auth in Phase 3

### 11.4 Budget Considerations
- [ ] **API Costs**: Allocated budget for paid APIs (Polygon.io $199/mo)?
- [ ] **Hosting Costs**: VPS budget ($20-50/mo for MVP, $200+/mo for K8s cluster)?
- [ ] **Development Time**: Solo developer or team? Expected timeline flexibility?

---

## 12. Next Steps

### 12.1 Immediate Actions
1. **Validate requirements** with stakeholders/users
2. **Finalize technology stack** (backend language, database, deployment)
3. **Set up development environment**:
   - GitHub repository
   - Project management tool (GitHub Projects, Linear, Jira)
   - CI/CD pipeline
4. **Create initial project structure**:
   - Mono-repo vs. separate repos for frontend/backend
   - Folder structure, linting, formatting configs
5. **Acquire data sources**:
   - Sign up for Alpha Vantage/Twelve Data/Polygon.io
   - Test API access for AGQ, GC=F, SI=F
   - Download sample ETF flow CSV from ETFdb.com

### 12.2 Phase 1 Sprint Planning
**Sprint 1 (Week 1-2)**: Foundation
- Set up database schema
- Create seed data loader (historical AGQ + silver prices)
- Build basic API endpoints (GET /etfs/AGQ/prices, GET /commodities/XAG/prices)

**Sprint 2 (Week 3-4)**: Data Collection
- Implement yfinance collectors
- Schedule daily jobs (cron)
- Build manual CSV upload endpoint for flows

**Sprint 3 (Week 5-6)**: Analytics Engine
- Implement z-score calculation
- Build correlation analysis
- Create signal generation logic (extreme flow)

**Sprint 4 (Week 7-8)**: Frontend & Integration
- Build React dashboard
- Integrate charts (Recharts)
- Connect to backend APIs
- Implement email alerting
- End-to-end testing

---

## Appendix A: Sample Data Structures

### A.1 ETF Flow CSV Format (ETFdb.com)
```csv
Date,Net Flow ($ Mil),AUM ($ Mil),Shares Outstanding,Premium/Discount (%)
2025-12-20,15.3,245.7,12500000,0.12
2025-12-13,-8.2,230.4,11800000,-0.05
2025-12-06,22.1,238.6,12100000,0.18
```

### A.2 Signal JSON Schema
```json
{
  "id": 1234,
  "ticker": "AGQ",
  "signal_type": "EXTREME_FLOW",
  "direction": "BUY",
  "strength": 0.87,
  "generated_at": "2025-12-26T10:00:00Z",
  "expires_at": "2026-01-26T10:00:00Z",
  "trigger_values": {
    "z_score_4w": 2.8,
    "percentile": 95.2,
    "net_flow": 22.1,
    "price_change_pct": 5.3,
    "correlation_flow_price": 0.72
  },
  "status": "ACTIVE"
}
```

### A.3 Alert Email Template
```
Subject: [COMMODITY ALERT] AGQ - Extreme Inflow Detected

AGQ (ProShares Ultra Silver 2x) - BUY Signal

Signal Strength: ★★★★☆ (4/5)
Generated: Dec 26, 2025 10:00 AM ET

Key Metrics:
• Weekly Net Flow: $22.1M (95th percentile)
• 4-Week Z-Score: 2.8 (extreme)
• Flow-Price Correlation: 0.72 (strong)
• AGQ Price: $42.15 (+5.3% this week)
• Spot Silver: $30.85/oz (+4.2% this week)

Interpretation:
Strong institutional inflow into AGQ coinciding with silver price rally suggests flow-driven momentum. Historical patterns indicate continuation probability of 68% over next 2-4 weeks.

View Dashboard: [link]

---
Disclaimer: This is an automated alert for informational purposes only. Not financial advice.
```

---

## Appendix B: Glossary

- **AGQ**: ProShares Ultra Silver ETF (2x leveraged long silver)
- **AUM**: Assets Under Management
- **COMEX**: Commodity Exchange (division of CME for metals futures)
- **ETF**: Exchange-Traded Fund
- **Front-Month**: Nearest futures contract expiration
- **NAV**: Net Asset Value
- **OHLCV**: Open, High, Low, Close, Volume
- **OI**: Open Interest (futures contracts outstanding)
- **Z-Score**: Statistical measure of how many standard deviations a value is from the mean
- **Contango**: Futures price > spot price
- **Backwardation**: Futures price < spot price

---

**Document Version**: 1.0
**Last Updated**: December 26, 2025
**Status**: Draft for Review
