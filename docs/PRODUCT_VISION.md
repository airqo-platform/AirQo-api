# AirQo Digital Products — Value Expansion & Developer Platform Roadmap

> **Audience:** All AirQo software engineers and anyone involved in the development, promotion, or growth of AirQo's digital product suite  
> **Purpose:** Shared framework for how each product should evolve to serve broader IoT markets and become reusable developer foundations  
> **Date:** June 2026

---

## 1. The Opportunity in One Sentence

Every product we have built to solve air quality problems is, at its core, a general-purpose IoT tool — and we should position and build it that way.

---

## 2. Our Products & Their Core Value Propositions

The pitches below are deliberately technology-agnostic. The goal is to lead with the problem and the relief the product brings — not the stack behind it.

---

### 2.1 AirQo Nexus — Data Visualisation & Insights Workspace

**The 30-second pitch**

> Organisations that deploy sensor networks end up with mountains of data and no clear way to share it with the people who need it most. AirQo Nexus solves that: it is a configurable workspace where teams can explore location-based sensor data, build visualisations, download datasets, and share insights — without writing a single line of code. If your organisation collects any kind of environmental or IoT data, this product turns it into decisions.

**Core capabilities (as currently built)**
- Multi-organisation workspace with role-based access
- Interactive maps tied to sensor locations
- Data download and export
- Custom dashboards and data visualisation
- Billing and usage management

**IoT expansion opportunity**
- The data model is sensor-agnostic; any time-series measurement (water quality, noise, traffic, soil) can flow in with schema adaptation
- The map and visualisation layer is reusable for any geospatial IoT deployment
- White-label and multi-tenancy support makes it suitable for enterprise IoT customers

---

### 2.2 Vertex — Device Network Management Console

**The 30-second pitch**

> When you operate dozens or hundreds of sensors across a city, knowing where every device is, whether it is working, and what group it belongs to becomes a full-time job. Vertex gives network operators a single console: a live inventory of every device and site, organised into logical groups called cohorts, with the ability to manage configurations without touching the devices directly. If you run any kind of sensor network, Vertex is your control room.

**Core capabilities (as currently built)**
- Device and site registry with full metadata
- Cohort (logical grouping) management
- Admin controls and network-wide oversight
- Desktop client (Electron) for offline or local-network use

**IoT expansion opportunity**
- The device/site/cohort model maps directly to any sensor deployment (agriculture, smart buildings, utilities)
- The desktop client (Vertex Desktop) is well suited for field engineers who need to manage devices without reliable internet
- Can be positioned as a generic "sensor network operations" console

---

### 2.3 Beacon — Fleet Operations & Maintenance Platform

**The 30-second pitch**

> IoT devices degrade quietly. Batteries die, firmware goes stale, sensors drift, and the first sign of a problem is often bad data that nobody trusted. Beacon gives fleet operators an early-warning system: real-time device health scores, automated firmware updates, stock management for spares, and audit trails for every maintenance action. Any organisation running a physical sensor fleet can use Beacon to stop reacting to failures and start preventing them.

**Core capabilities (as currently built)**
- Device collocation and data quality analytics
- Firmware OTA (over-the-air) distribution and version control
- Alerts and maintenance scheduling
- Inventory and spare parts tracking
- Performance reports

**IoT expansion opportunity**
- Firmware OTA, health scoring, and maintenance tracking are universal fleet management problems
- The collocation module can be repurposed for any sensor calibration workflow
- Stock and audit features make this viable for regulated industries (health, utilities, agriculture)

---

### 2.4 Mobile App — Personal Environmental Awareness

**The 30-second pitch**

> Most people have no idea whether the air around them right now is safe to breathe — let alone what it will be like tomorrow. Our mobile app changes that: it shows you real-time conditions at your location, gives you a seven-day forecast, and tells you exactly what to do to protect yourself and your family. Beyond air quality, the same app architecture — maps, forecasts, health guidance, location check-ins — applies to any environmental risk that affects daily human behaviour.

**Core capabilities (as currently built)**
- Real-time air quality map with location awareness
- 24-hour and 7-day forecasts
- Personal exposure tracking
- Health tips and educational content
- Surveys and community feedback

**IoT expansion opportunity**
- The exposure tracking and notification system is reusable for any environmental metric (UV, heat, noise)
- The "learn" section is a generic environmental health education module
- Cities, hospitals, and public health bodies can co-brand or embed the app for their own environmental health programmes

---

### 2.5 AirQalibrate — Sensor Calibration Workbench

**The 30-second pitch**

> Low-cost sensors are affordable, but they drift — and without periodic recalibration, the data they produce becomes misleading. Most organisations do not have data scientists on staff to run co-location studies and apply correction models. AirQalibrate makes that process self-service: teams upload co-location data, run calibration workflows, and push corrected readings back into their network. Any organisation using low-cost sensors — regardless of what they are measuring — faces this problem.

**IoT expansion opportunity**
- Calibration against a reference instrument is a universal problem across environmental sensing
- The correction pipeline can be extended to any sensor type: gas, particulate, temperature, humidity, noise

---

### 2.6 AirQo AI Platform (ai.airqo.net) — Environmental Intelligence Suite

> **Naming note:** The **AirQo AI Platform** name is currently under review with the goal of finding something more distinctive that communicates the full breadth of intelligence capabilities it provides, rather than being associated with any single feature. Engineers should avoid baking the current name into hard-to-change places (URLs, API namespaces, package names) until the review concludes.

**The 30-second pitch**

> Collecting sensor data is the easy part. Making sense of it — knowing where to place the next sensor, what a location actually represents, what the air will look like on Thursday, and how to explain all of it to a policymaker — is where most organisations get stuck. The AirQo AI Platform is the intelligence layer that answers those questions: it tells you where to deploy sensors, classifies what those locations represent, forecasts conditions days ahead, and turns all of that into automated reports your team did not have to write. Any organisation managing an environmental monitoring programme can use it to move from raw data to informed decisions without a team of data scientists.

**Core capabilities (as currently built)**
- **Forecast** — Hourly (next 24 h) and daily (next 7 days) PM2.5 predictions per site
- **LOCATE** — AI-powered recommendations for optimal sensor placement using geospatial analysis
- **Categorize** — Classifies monitoring sites by environmental and surrounding characteristics
- **Report** — Automated generation of air quality summaries and compliance reports
- **Spatial Analysis** — Hotspot identification, clustering, and spatial distribution mapping
- **Environmental Intelligence Dashboard** — Unified view of trends, forecasts, and monitoring insights
- **Data Integration** — Combines monitoring device data with meteorological and environmental datasets

**IoT expansion opportunity**
- LOCATE and Categorize are generic spatial intelligence tools — optimal placement and classification of monitoring assets applies to any sensor type (water, noise, energy, traffic)
- The forecasting layer is time-series agnostic; any sensor metric with historical depth can feed a forecast model
- The reporting engine can generate automated summaries for any environmental dataset — not just air quality
- Can be licensed as a standalone intelligence service to city governments, utilities, NGOs, and researchers
- The dashboard is reusable as a white-label environmental intelligence portal for any monitoring network

---

### 2.7 Air Quality API — Open Data Access Layer

**The 30-second pitch**

> The most useful sensor network in the world delivers zero value if the data is locked inside a proprietary system. Our API makes every reading from the AirQo network — raw and calibrated — available to any developer, researcher, or government agency that wants to build on top of it. Whether you are building a health app, a city dashboard, or a research model, you should not have to collect your own data to start.

**Core capabilities (as currently built)**
- Access to raw and calibrated sensor readings across the network
- Open access designed for third-party developers and researchers
- Supports integration into custom applications, dashboards, and models

**IoT expansion opportunity**
- The API layer is the reusable interface contract for any AirQo-powered IoT network
- As products become domain-agnostic, the API becomes the distribution mechanism for any sensor data type
- A well-documented, versioned public API is the primary enabler of the developer template ecosystem described in Section 3

---

## 3. The Developer Platform Vision

### 3.1 The Problem

Our products are built for AirQo's network. But the patterns we have engineered — device registries, fleet management consoles, analytics dashboards, forecasting pipelines — are patterns that hundreds of IoT teams around the world are rebuilding from scratch every year.

We have an opportunity to change that.

### 3.2 The Model: Installable Product Templates

The goal is to make every major AirQo digital product available as a **bootstrapable template** — the same way `create-next-app` or `create-react-app` lets a developer start a production-ready project with one command.

```bash
# Example future developer experience
npx create-airqo-platform my-iot-dashboard
npx create-airqo-vertex my-device-console
npx create-airqo-beacon my-fleet-manager
npx create-airqo-ai my-intelligence-platform
npx create-airqo-calibrate my-calibration-tool
```

A developer runs the command, answers a few configuration questions (sensor type, data schema, branding), and gets a fully working, domain-agnostic version of the product they can deploy and build on top of.

### 3.3 What Each Template Should Provide Out of the Box

| Template | What the developer inherits |
|---|---|
| `create-airqo-platform` | Multi-org analytics workspace, maps, charts, data export, auth |
| `create-airqo-vertex` | Device & site registry, grouping, admin console, API proxy layer |
| `create-airqo-beacon` | Fleet health dashboard, OTA firmware, alerts, stock management |
| `create-airqo-mobile` | Cross-platform mobile app with maps, forecasts, notifications, auth |
| `create-airqo-ai` | Forecasting pipeline, sensor placement engine, site classifier, automated reporting, spatial analysis dashboard |
| `create-airqo-calibrate` | Co-location calibration workflow, correction pipeline |

### 3.4 What Engineers Should Do Now

This vision has engineering implications for every roadmap. Concretely:

1. **Decouple domain from infrastructure.** Any place where `air quality`, `PM2.5`, `AQI` is hardcoded into core logic (routing, data models, API contracts) should be made configurable. The domain label should be a configuration value, not a code constant.

2. **Publish a `vertex-template` (already exists — ship it).** The `vertex-template` directory in the frontend repo is a head start. Define what the "template contract" is: which files are the skeleton, which are domain-specific, and document how to swap them.

3. **Expose data schemas as configuration.** AirQo Nexus and Beacon should let operators define what metrics they track through config files or a schema editor — not by forking and modifying source code.

4. **API-first everything.** Backend services (ai-platform, calibrate, beacon-api, analytics) should be fully functional with zero frontend dependency. This allows the backend to be reused by any frontend template, not just AirQo's.

5. **Write IoT-generic documentation.** Product READMEs and onboarding guides should frame the product in terms of the generic IoT problem it solves first, and air quality as the reference implementation second.

6. **Versioned, publishable templates.** Each template should have its own versioning strategy (semantic versioning), changelog, and an `npm` or `pip` publication path so the community can install and update them.

---

## 4. Roadmap Priorities by Product

| Product | Immediate IoT expansion | Template readiness |
|---|---|---|
| AirQo Nexus | Make sensor metric labels configurable | Extract to `create-airqo-platform`; document module boundaries |
| Vertex | Generalise device schema beyond air quality sensors | `vertex-template` already exists; define and publish the contract |
| Beacon | Make alert thresholds and metric types configurable per deployment | Extract core fleet management UI as template |
| Mobile App | Enable metric type and health guidance content to be injected via config | Publish Flutter template with swappable data domain |
| AirQalibrate | Abstract sensor type from calibration pipeline | Publish as standalone calibration workbench template |
| AirQo AI Platform (ai.airqo.net) | Generalise LOCATE, Categorize, and Forecast for any sensor type; accept arbitrary time-series metrics | Publish as `create-airqo-ai`; each feature (forecast, locate, categorize, report) should be independently mountable |
| Air Quality API | Extend data contracts to support arbitrary sensor metric types | Already API-first; focus on versioning, public docs, and developer onboarding |

---

## 5. The Investor-Facing Summary

For any investor conversation, this is the frame:

- We did not just build air quality products. We built the **operating system for environmental IoT networks** — and we did it the hard way, by running a real network with real devices in real African cities.
- Our suite covers the full lifecycle: deploy sensors (Vertex), keep them healthy (Beacon), calibrate them (AirQalibrate), visualise the data (AirQo Nexus), deliver intelligence on top of it (AirQo AI Platform), make it personal (Mobile App), and open it to builders everywhere (Air Quality API).
- The AirQo AI Platform alone gives any organisation five things that normally require separate vendors: forecasting, optimal sensor placement, site classification, automated reporting, and spatial analysis — in one product.
- Every product in our suite solves a problem that any IoT operator faces, regardless of what they are measuring.
- We are now making each product available as a **reusable foundation** so that any organisation — a water utility, a smart city, an agriculture company — can deploy a production-grade IoT stack in days, not years.
- AirQo becomes the **platform layer** of the IoT ecosystem in Africa and beyond, not just an air quality monitoring company.

---

## 6. What This Is NOT

To keep focus:

- This is not about rebuilding everything. The products work. The task is to **configure and document** them for broader use, not rewrite them.
- This is not about removing the air quality mission. AirQo's core purpose remains. These templates expand reach; they do not dilute identity.
- This is not a separate product team. Every engineer owns the "template-readiness" of their product within their existing roadmap.

---

## 7. Next Steps for Engineers

Each engineering team should add the following to their next roadmap cycle:

- [ ] Audit hardcoded domain-specific values in core product logic
- [ ] Identify which modules are generic infrastructure vs. air-quality-specific
- [ ] Propose a configuration interface for the domain-specific parts
- [ ] Draft a "template README" describing how a new IoT operator would deploy their product for a different sensor type
- [ ] Flag any API contract changes needed to support generic metric types

---

*This document is a living framework. Engineers are encouraged to annotate and propose amendments via PRs to this file. The goal is alignment, not prescription.*
